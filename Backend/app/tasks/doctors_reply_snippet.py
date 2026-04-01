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

    # Group HH:MM times by doctor
    doctors: dict[str, list[str]] = {}
    for slot in slots:
        name = slot.doctor_name or "Doctor"
        doctors.setdefault(name, []).append(slot.time_str)

    def fmt(t: str) -> str:
        """HH:MM → H:MM AM/PM"""
        try:
            h, m = map(int, t.split(":"))
            ampm = "AM" if h < 12 else "PM"
            h12 = h if h <= 12 else h - 12
            h12 = h12 or 12
            return f"{h12}:{m:02d} {ampm}"
        except Exception:
            return t

    def slots_to_windows(times: list[str]) -> list[str]:
        """
        Convert sorted HH:MM list into human-readable window strings.
        Detects gaps > 30 min and creates separate windows.
        e.g. ["09:00"..."12:30", "18:00"..."21:30"]
             → ["9:00 AM – 1:00 PM", "6:00 PM – 10:00 PM"]
        """
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
                # Gap detected — close current window, add 30 min to get end
                end_mins = prev_h * 60 + prev_m + 30
                end_str = f"{end_mins // 60:02d}:{end_mins % 60:02d}"
                windows.append(f"{fmt(start)} – {fmt(end_str)}")
                start = t
                prev_h, prev_m = curr_h, curr_m

        # Close last window
        end_mins = prev_h * 60 + prev_m + 30
        end_str = f"{end_mins // 60:02d}:{end_mins % 60:02d}"
        windows.append(f"{fmt(start)} – {fmt(end_str)}")
        return windows

    lines = ["👨‍⚕️ *Doctors available today:*\n"]
    for doctor, times in doctors.items():
        times_sorted = sorted(times)
        windows = slots_to_windows(times_sorted)
        lines.append(f"• *{doctor}*")
        for w in windows:
            lines.append(f"  🕐 {w}")

    lines.append("\nType *book* to book an appointment.")
    return "\n".join(lines)
