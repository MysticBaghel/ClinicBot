import os
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))


async def process_incoming_message(
    tenant_id: str,
    sender_phone: str,
    message_id: str,
    message_type: str,
    text: str | None,
):
    try:
        await _handle(tenant_id, sender_phone, message_id, message_type, text)
    except Exception as exc:
        import traceback
        print(f"[process] Error handling message from {sender_phone}: {exc}")
        traceback.print_exc()


async def _handle(
    tenant_id: str,
    sender_phone: str,
    message_id: str,
    message_type: str,
    text: str | None,
):
    from app.services.session import get_session, save_session, add_to_history
    from app.services.intent import detect_intent, BOOK, CANCEL, ASK_AI, HANDOFF, GREETING, OUT_OF_SCOPE, DOCTORS, SERVICES
    from app.services.whatsapp import send_text, send_buttons, send_list
    from app.services.flows import handle_flow
    from app.services.groq import ask_groq
    from app.models.timeslot import TimeSlot
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
    from app.models.tenant import Tenant
    from sqlalchemy import select
    from dotenv import load_dotenv
    load_dotenv()

    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/clinic_db")
    engine = create_async_engine(DATABASE_URL, echo=False)
    AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
            tenant = result.scalar_one_or_none()
            if not tenant:
                return

            phone_number_id = tenant.wa_phone_number_id
            access_token    = tenant.wa_access_token
            system_prompt   = tenant.system_prompt or ""

            session = await get_session(tenant_id, sender_phone)

            if message_type == "interactive":
                pass
            elif message_type != "text" or not text:
                await send_text(phone_number_id, access_token, sender_phone,
                                "Sorry, I can only read text messages right now.")
                return

            session = add_to_history(session, text)
            lowered = text.strip().lower()

            # ── Global reset — always works, even during handoff ──────────────
            if lowered in ["hi", "hello", "hey", "restart", "start"]:
                session["flow"] = None
                session["step"] = None
                session["data"] = {}
                session["handoff"] = False
                session.pop("skip_duplicate_check", None)

            # ── Handoff block — AFTER reset check ────────────────────────────
            if session.get("handoff"):
                await save_session(tenant_id, sender_phone, session)
                return

            # ── Cancel active flow ────────────────────────────────────────────
            if lowered in ["cancel", "stop", "quit", "exit"] and session.get("flow"):
                session["flow"] = None
                session["step"] = None
                session["data"] = {}
                session.pop("skip_duplicate_check", None)
                await save_session(tenant_id, sender_phone, session)
                await send_text(phone_number_id, access_token, sender_phone,
                                "Cancelled. Type *hi* to start again. 👋")
                return

            if session.get("flow"):
                session, reply = await handle_flow(session, text, tenant, sender_phone, db)
                await save_session(tenant_id, sender_phone, session)
                await _send_reply(reply, session, phone_number_id, access_token, sender_phone)
                return

            intent = await detect_intent(text, session["history"], system_prompt)

            # ── GREETING ──────────────────────────────────────────────────────
            if intent == GREETING:
                today_dow = datetime.now(IST).weekday()
                open_slot = (await db.execute(
                    select(TimeSlot).where(
                        TimeSlot.tenant_id == tenant_id,
                        TimeSlot.day_of_week == today_dow,
                        TimeSlot.is_active == True,
                    ).limit(1)
                )).scalars().first()
                clinic_status = (
                    "🟢 *Clinic is open today!*" if open_slot else
                    "🔴 *Clinic is closed today.* You can still book for another day."
                )
                session["flow"] = None
                session["step"] = None
                session["data"] = {}
                session["_pending_buttons"] = {
                    "body": (
                        f"Hello! Welcome to {tenant.name}. 👋\n"
                        f"{clinic_status}\n\n"
                        "How can I help you today?\n"
                        "Type *help* for staff or *restart* to start over."
                    ),
                    "buttons": [
                        {"id": "btn_book",    "title": "Book Appointment"},
                        {"id": "btn_cancel",  "title": "Cancel Appointment"},
                        {"id": "btn_doctors", "title": "Doctors Today"},
                    ]
                }
                reply = "__BUTTONS__"

            # ── DOCTORS ───────────────────────────────────────────────────────
            elif intent == DOCTORS:
                reply = await _build_doctors_reply(tenant_id, db)
            # ── SERVICES ──────────────────────────────────────────────────────────────
            elif intent == SERVICES:
                svcs = tenant.services or []
                if not svcs:
                    reply = "We don't have any services listed yet. Type *help* to speak with our staff."
                else:
                    lines = ["💊 *Our Services:*\n"]
                    for s in svcs:
                        line = f"• *{s['name']}*"
                        if s.get("price"):    line += f" — ₹{s['price']}"
                        if s.get("duration"): line += f" ({s['duration']} min)"
                        if s.get("note"):     line += f"\n  _{s['note']}_"
                        lines.append(line)
                    lines.append("\nType *book* to book an appointment.")
                    reply = "\n".join(lines)

            # ── BOOK ──────────────────────────────────────────────────────────
            elif intent == BOOK:
                session["flow"] = "booking"
                session["step"] = "ask_name"
                session["skip_duplicate_check"] = True
                reply = "Sure! Let's book an appointment. 📅\n\nFirst, what is your full name?"

            # ── CANCEL ────────────────────────────────────────────────────────
            elif intent == CANCEL:
                session["flow"] = "cancel"
                session["step"] = "ask_cancel_confirm"
                session["data"] = {}
                reply = (
                    "I can help you cancel your appointment. 🗓️\n\n"
                    "Are you sure you want to cancel your most recent appointment?\n\n"
                    "Reply *yes* to confirm cancellation or *no* to go back."
                )

            # ── ASK_AI — route to Gemini ──────────────────────────────────────
            elif intent == ASK_AI:
                # Send a "thinking" indicator first so the patient knows we're working
                await send_text(
                    phone_number_id, access_token, sender_phone,
                    "Let me find that for you... 🤔"
                )
                answer = await ask_groq(text, system_prompt)
                reply = answer

            # ── HANDOFF ───────────────────────────────────────────────────────
            elif intent == HANDOFF:
                session["handoff"] = True
                reply = (
                    f"Sure! Please contact our staff directly. 🙏\n\n"
                    f"📞 *{tenant.phone}*\n\n"
                    f"They will assist you shortly. Type *hi* anytime to start over."
                )

            # ── OUT_OF_SCOPE / fallback ───────────────────────────────────────
            else:
                reply = (
                    "I'm sorry, I didn't quite understand that. 🤔\n\n"
                    "You can:\n"
                    "• Type *book* to book an appointment\n"
                    "• Type *doctors* to see today's available doctors\n"
                    "• Ask me any question about our services\n"
                    "• Type *help* to talk to staff"
                )

            await save_session(tenant_id, sender_phone, session)
            await _send_reply(reply, session, phone_number_id, access_token, sender_phone)

    finally:
        await engine.dispose()


def _fmt_time(t: str) -> str:
    try:
        h, m = map(int, t.split(":"))
        ampm = "AM" if h < 12 else "PM"
        h12 = h if h <= 12 else h - 12
        h12 = h12 or 12
        return f"{h12}:{m:02d} {ampm}"
    except Exception:
        return t


def _slots_to_windows(times: list[str]) -> list[str]:
    if not times:
        return []
    windows = []
    start = times[0]
    prev_h, prev_m = map(int, times[0].split(":"))
    for t in times[1:]:
        curr_h, curr_m = map(int, t.split(":"))
        curr_mins = curr_h * 60 + curr_m
        prev_mins = prev_h * 60 + prev_m
        if curr_mins - prev_mins == 30:
            prev_h, prev_m = curr_h, curr_m
        else:
            end_mins = prev_h * 60 + prev_m + 30
            end_str = f"{end_mins // 60:02d}:{end_mins % 60:02d}"
            windows.append(f"{_fmt_time(start)} – {_fmt_time(end_str)}")
            start = t
            prev_h, prev_m = curr_h, curr_m
    end_mins = prev_h * 60 + prev_m + 30
    end_str = f"{end_mins // 60:02d}:{end_mins % 60:02d}"
    windows.append(f"{_fmt_time(start)} – {_fmt_time(end_str)}")
    return windows


async def _build_doctors_reply(tenant_id: str, db) -> str:
    from sqlalchemy import select
    from app.models.timeslot import TimeSlot

    today_dow = datetime.now(IST).weekday()
    result = await db.execute(
        select(TimeSlot).where(
            TimeSlot.tenant_id == tenant_id,
            TimeSlot.day_of_week == today_dow,
            TimeSlot.is_active == True,
        ).order_by(TimeSlot.doctor_name, TimeSlot.time_str)
    )
    slots = result.scalars().all()

    if not slots:
        return (
            "No doctors are scheduled for today. 😔\n\n"
            "Type *help* to speak with our staff, or *book* to request an appointment."
        )

    doctors: dict[str, list[str]] = {}
    for slot in slots:
        name = slot.doctor_name or "Doctor"
        doctors.setdefault(name, []).append(slot.time_str)

    lines = ["👨‍⚕️ *Doctors available today:*\n"]
    for doctor, times in doctors.items():
        times_sorted = sorted(times)
        windows = _slots_to_windows(times_sorted)
        lines.append(f"• *{doctor}*")
        for w in windows:
            lines.append(f"  🕐 {w}")

    lines.append("\nType *book* to book an appointment.")
    return "\n".join(lines)


async def _send_reply(reply: str, session: dict, phone_number_id: str, access_token: str, to: str):
    from app.services.whatsapp import send_text, send_buttons, send_list

    if reply == "__BUTTONS__":
        pending = session.get("_pending_buttons", {})
        await send_buttons(
            phone_number_id, access_token, to,
            pending.get("body", "Choose an option:"),
            pending.get("buttons", [])
        )
    elif reply == "__LIST__":
        pending = session.get("_pending_list", {})
        await send_list(
            phone_number_id, access_token, to,
            pending.get("body", "Choose an option:"),
            pending.get("button_label", "View Options"),
            pending.get("items", [])
        )
    else:
        await send_text(phone_number_id, access_token, to, reply)
