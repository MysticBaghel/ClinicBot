from datetime import datetime, date, timezone, timedelta
from typing import Optional
from app.services.whatsapp import send_text, send_buttons, send_list

IST = timezone(timedelta(hours=5, minutes=30))


def _service_name(service) -> str:
    """Extract the display name from a service entry.
    Services can be stored as dicts {name, price, ...} or plain strings.
    """
    if isinstance(service, dict):
        return service.get("name") or service.get("category") or str(service)
    return str(service).strip()

DAYS_LIST = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]

MONTH_MAP = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}

def _parse_date(text: str) -> Optional[str]:
    text = text.strip().lower()
    today = datetime.now(IST).date()

    if text == "today":
        return today.isoformat()
    if text == "tomorrow":
        return (today + timedelta(days=1)).isoformat()

    for fmt in ("%d/%m/%Y", "%d/%m", "%d-%m-%Y", "%d-%m"):
        try:
            parsed = datetime.strptime(text, fmt)
            year = parsed.year if parsed.year != 1900 else today.year
            return date(year, parsed.month, parsed.day).isoformat()
        except ValueError:
            pass

    parts = text.split()
    if len(parts) == 2:
        for a, b in [(parts[0], parts[1]), (parts[1], parts[0])]:
            if b in MONTH_MAP:
                try:
                    return date(today.year, MONTH_MAP[b], int(a)).isoformat()
                except (ValueError, KeyError):
                    pass

    return None


def _parse_time(text: str) -> Optional[str]:
    text = text.strip().lower().replace(" ", "")

    for fmt in ("%I:%M%p", "%I%p", "%H:%M"):
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.strftime("%H:%M")
        except ValueError:
            pass

    for suffix in ["am", "pm"]:
        if text.endswith(suffix):
            try:
                hour = int(text[:-2])
                if suffix == "pm" and hour != 12:
                    hour += 12
                if suffix == "am" and hour == 12:
                    hour = 0
                return f"{hour:02d}:00"
            except ValueError:
                pass

    return None


async def _is_day_open(tenant_id: str, day_of_week: int, db) -> bool:
    from sqlalchemy import select
    from app.models.timeslot import TimeSlot

    result = await db.execute(
        select(TimeSlot).where(
            TimeSlot.tenant_id == tenant_id,
            TimeSlot.day_of_week == day_of_week,
            TimeSlot.is_active == True,
        ).limit(1)
    )
    return result.scalars().first() is not None


async def _get_active_appointment(tenant_id: str, phone: str, db):
    """
    Returns only strictly future confirmed appointments.
    Past-time appointments (even from today) are ignored.
    """
    from sqlalchemy import select
    from app.models.appointment import Appointment

    now = datetime.now(IST)

    result = await db.execute(
        select(Appointment).where(
            Appointment.tenant_id == tenant_id,
            Appointment.patient_phone == phone,
            Appointment.status == "confirmed",
            Appointment.appointment_dt > now,   # strictly future only
        ).order_by(Appointment.appointment_dt.asc())
    )
    return result.scalars().first()


async def handle_flow(
    session: dict,
    text: str,
    tenant,
    sender_phone: str,
    db,
) -> tuple[dict, str]:
    flow = session.get("flow")

    if flow == "booking":
        return await _booking_flow(session, text, tenant, sender_phone, db)
    elif flow == "cancel":
        return await _cancel_flow(session, text, tenant, sender_phone, db)

    session["flow"] = None
    session["step"] = None
    return session, "Something went wrong. Let's start over. Type *hi* to begin."


async def _booking_flow(
    session: dict,
    text: str,
    tenant,
    sender_phone: str,
    db,
) -> tuple[dict, str]:

    step = session.get("step")
    data = session.get("data", {})

    # ── ask_name ──────────────────────────────────────────────────────────────
    if step == "ask_name":
        name = text.strip()
        if len(name) < 2:
            return session, "Please enter your full name (at least 2 characters)."

        # ── Duplicate booking check (skipped if user explicitly chose Book Another) ──
        if not session.get("skip_duplicate_check"):
            existing = await _get_active_appointment(tenant.id, sender_phone, db)
            if existing:
                dt = existing.appointment_dt.astimezone(IST) if existing.appointment_dt else None
                date_str = dt.strftime("%d %B %Y") if dt else ""
                time_str = dt.strftime("%I:%M %p") if dt else ""

                data["name"] = name
                session["data"] = data
                session["flow"] = None
                session["step"] = None

                session["_pending_buttons"] = {
                    "body": (
                        f"You already have an upcoming appointment. 📅\n\n"
                        f"👤 Name: *{existing.patient_name or name}*\n"
                        f"🏥 Service: *{existing.service}*\n"
                        f"📅 Date: *{date_str}*\n"
                        f"🕐 Time: *{time_str}*\n\n"
                        f"What would you like to do?"
                    ),
                    "buttons": [
                        {"id": "btn_cancel", "title": "Cancel This"},
                        {"id": "btn_book",   "title": "Book Another"},
                    ]
                }
                return session, "__BUTTONS__"

        # Clear the flag once we're past the check
        session.pop("skip_duplicate_check", None)

        data["name"] = name
        session["data"] = data
        session["step"] = "ask_service"

        services = tenant.services or []
        if not services:
            return session, "What service do you need? (e.g. General Checkup, Blood Test)"

        service_names = [_service_name(s) for s in services]
        numbered = "\n".join(f"{i+1}. {n}" for i, n in enumerate(service_names))
        return session, (
            f"Thanks {name}! 😊 Which service do you need?\n\n"
            f"{numbered}\n\n"
            "Reply with the *number* of your choice."
        )

    # ── ask_service ───────────────────────────────────────────────────────────
    elif step == "ask_service":
        service_input = text.strip()
        services = tenant.services or []
        service_names = [_service_name(s) for s in services]

        # Patient replied with a number
        if service_input.isdigit():
            idx = int(service_input) - 1
            if 0 <= idx < len(service_names):
                service = service_names[idx]
            else:
                numbered = "\n".join(f"{i+1}. {n}" for i, n in enumerate(service_names))
                return session, (
                    f"Please reply with a number between 1 and {len(service_names)}.\n\n"
                    f"{numbered}"
                )
        else:
            # Also accept typing the name directly (fuzzy match)
            matched = next((n for n in service_names if n.lower() == service_input.lower()), None)
            if not matched:
                matched = next((n for n in service_names if service_input.lower() in n.lower()), None)
            if matched:
                service = matched
            else:
                numbered = "\n".join(f"{i+1}. {n}" for i, n in enumerate(service_names))
                return session, (
                    f"Please reply with the *number* of your choice:\n\n"
                    f"{numbered}"
                )

        data["service"] = service
        session["data"] = data
        session["step"] = "ask_date"

        return session, (
            f"Got it — *{service}*. 📋\n\n"
            "What date would you like?\n"
            "You can say: *today*, *tomorrow*, *15 march*, or *15/03*"
        )

    # ── ask_date ──────────────────────────────────────────────────────────────
    elif step == "ask_date":
        parsed = _parse_date(text)
        if not parsed:
            return session, (
                "I couldn't understand that date. 🤔\n"
                "Please try: *tomorrow*, *15 march*, or *15/03/2026*"
            )

        if parsed < datetime.now(IST).date().isoformat():
            return session, "That date has already passed. Please choose a future date."

        chosen_day = datetime.strptime(parsed, "%Y-%m-%d").weekday()
        day_open = await _is_day_open(tenant.id, chosen_day, db)
        if not day_open:
            day_name = DAYS_LIST[chosen_day]
            return session, (
                f"Sorry, the clinic is closed on *{day_name}* ({parsed}). 🔴\n\n"
                "Please choose a different date when we're open."
            )

        data["date"] = parsed
        session["data"] = data
        session["step"] = "ask_time"

        return session, (
            f"Date set: *{parsed}* ✅\n\n"
            "What time would you prefer? e.g. *10am*, *2:30pm*\n\n"
            "_The clinic will confirm or reschedule based on doctor availability._"
        )

    # ── ask_time ──────────────────────────────────────────────────────────────
    elif step == "ask_time":
        parsed_time = _parse_time(text.strip())
        if not parsed_time:
            return session, (
                "I couldn't understand that time. 🕐\n"
                "Please try: *10am*, *2:30pm*, or *14:00*"
            )

        # ── Past time check (only if booking today) ───────────────────────────
        selected_date = data.get("date", "")
        today_str = datetime.now(IST).date().isoformat()
        if selected_date == today_str:
            now_time = datetime.now(IST).strftime("%H:%M")
            if parsed_time <= now_time:
                return session, (
                    f"That time has already passed today. 🕐\n\n"
                    "Please choose a future time, or type *tomorrow* to go back and pick tomorrow's date."
                )

        data["time"] = parsed_time
        session["data"] = data
        session["step"] = "confirm"

        d = data
        return session, (
            f"Please confirm your appointment: ✅\n\n"
            f"👤 Name: *{d.get('name')}*\n"
            f"🏥 Service: *{d.get('service')}*\n"
            f"📅 Date: *{d.get('date')}*\n"
            f"🕐 Time: *{d.get('time')}*\n\n"
            "Reply *yes* to confirm or *no* to cancel."
        )

    # ── confirm ───────────────────────────────────────────────────────────────
    elif step == "confirm":
        answer = text.strip().lower()

        if answer in ["yes", "y", "confirm", "ok", "okay", "haan", "ha"]:
            saved = await _save_appointment(session["data"], tenant.id, sender_phone, db)
            if saved:
                reply = (
                    f"Appointment confirmed! 🎉\n\n"
                    f"We'll see you on *{session['data'].get('date')}* "
                    f"at *{session['data'].get('time')}*.\n\n"
                    f"The clinic will confirm the exact slot based on doctor availability. 🔔"
                )
            else:
                reply = "Appointment saved! We'll see you soon. 🙏"

            session["flow"] = None
            session["step"] = None
            session["data"] = {}
            session.pop("_pending_buttons", None)
            session.pop("_pending_list", None)
            return session, reply

        elif answer in ["no", "n", "nahi", "nope", "cancel"]:
            session["flow"] = None
            session["step"] = None
            session["data"] = {}
            session.pop("_pending_buttons", None)
            session.pop("_pending_list", None)
            return session, "No problem! Booking cancelled. Type *book* anytime to start again."

        else:
            return session, "Please reply with *yes* to confirm or *no* to cancel."

    session["flow"] = None
    session["step"] = None
    return session, "Something went wrong. Type *hi* to start over."


# ── Cancel flow ───────────────────────────────────────────────────────────────

async def _cancel_flow(
    session: dict,
    text: str,
    tenant,
    sender_phone: str,
    db,
) -> tuple[dict, str]:
    from sqlalchemy import select
    from app.models.appointment import Appointment

    step = session.get("step")

    if step == "ask_cancel_confirm":
        answer = text.strip().lower()

        if answer in ["yes", "y", "confirm", "ok", "haan", "ha"]:
            result = await db.execute(
                select(Appointment).where(
                    Appointment.tenant_id == tenant.id,
                    Appointment.patient_phone == sender_phone,
                    Appointment.status == "confirmed",
                ).order_by(Appointment.appointment_dt.desc())
            )
            appt = result.scalars().first()

            session["flow"] = None
            session["step"] = None
            session["data"] = {}

            if not appt:
                return session, "I couldn't find any active appointments for your number. Type *book* to make a new one."

            appt.status = "cancelled"
            await db.commit()

            dt = appt.appointment_dt.astimezone(IST) if appt.appointment_dt else None
            date_str = dt.strftime("%d %B %Y") if dt else ""
            time_str = dt.strftime("%I:%M %p") if dt else ""

            return session, (
                f"Your appointment has been cancelled. ✅\n\n"
                f"📅 *{date_str}* at *{time_str}*\n"
                f"🏥 Service: *{appt.service}*\n\n"
                f"Type *book* anytime to make a new appointment. 🙏"
            )

        elif answer in ["no", "n", "nahi", "nope"]:
            session["flow"] = None
            session["step"] = None
            session["data"] = {}
            return session, "No problem! Your appointment is still active. Type *hi* if you need anything else."

        else:
            return session, "Please reply *yes* to confirm cancellation or *no* to keep your appointment."

    session["flow"] = None
    session["step"] = None
    return session, "Something went wrong. Type *hi* to start over."


# ── Save appointment to DB ────────────────────────────────────────────────────

async def _save_appointment(data: dict, tenant_id: str, phone: str, db) -> bool:
    try:
        from app.models.appointment import Appointment
        import uuid

        dt_str = f"{data['date']} {data['time']}"
        appointment_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M").replace(tzinfo=IST)

        appt = Appointment(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            patient_phone=phone,
            patient_name=data.get("name"),
            service=data.get("service"),
            appointment_dt=appointment_dt,
            status="confirmed",
            reminder_sent=False,
        )
        db.add(appt)
        await db.commit()
        return True
    except Exception as e:
        print(f"Error saving appointment: {e}")
        return False
