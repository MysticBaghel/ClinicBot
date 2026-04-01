from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from datetime import datetime, timezone, timedelta
from pydantic import BaseModel

from app.db.database import get_db
from app.models.appointment import Appointment
from app.dependencies import get_current_tenant
from app.models.tenant import Tenant

router = APIRouter()

IST = timezone(timedelta(hours=5, minutes=30))


@router.get("/")
async def get_appointments(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = Query(None),
    date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    result = await db.execute(
        select(Appointment).where(Appointment.tenant_id == tenant.id)
    )
    appointments = result.scalars().all()

    if status and status != "all":
        appointments = [a for a in appointments if a.status == status]
    if date:
        appointments = [a for a in appointments if a.appointment_dt and a.appointment_dt.astimezone(IST).date().isoformat() == date]
    if search:
        s = search.lower()
        appointments = [a for a in appointments if
            (a.patient_name and s in a.patient_name.lower()) or
            (a.patient_phone and s in a.patient_phone) or
            (a.service and s in a.service.lower())
        ]

    appointments = sorted(appointments, key=lambda x: x.appointment_dt or datetime.min.replace(tzinfo=IST))

    return [
        {
            "id": a.id,
            "patientName": a.patient_name or "Unknown",
            "phone": a.patient_phone,
            "service": a.service or "General",
            "date": a.appointment_dt.astimezone(IST).date().isoformat() if a.appointment_dt else "",
            "time": a.appointment_dt.astimezone(IST).strftime("%I:%M %p") if a.appointment_dt else "—",
            "status": a.status,
            "reminderSent": a.reminder_sent,
            "completed": a.completed,
            "avatar": "".join(w[0] for w in (a.patient_name or "UN").split()[:2]).upper(),
            "notes": "",
        }
        for a in appointments
    ]


@router.patch("/{appointment_id}/complete")
async def toggle_complete(
    appointment_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == tenant.id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appt.completed = not appt.completed
    await db.commit()
    return {"completed": appt.completed}



async def cancel_appointment(
    appointment_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == tenant.id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    appt.status = "cancelled"
    await db.commit()
    return {"message": "Appointment cancelled"}


@router.post("/{appointment_id}/remind")
async def send_reminder(
    appointment_id: str,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == tenant.id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    dt = appt.appointment_dt.astimezone(IST) if appt.appointment_dt else None
    date_str = dt.strftime("%d %B %Y") if dt else "your appointment"
    time_str = dt.strftime("%I:%M %p") if dt else ""

    from app.services.whatsapp import send_text
    message = (
        f"Hello {appt.patient_name or 'there'}! 👋\n\n"
        f"This is a reminder for your appointment at *{tenant.name}*.\n\n"
        f"📅 Date: *{date_str}*\n"
        f"🕐 Time: *{time_str}*\n"
        f"🏥 Service: *{appt.service or 'General Checkup'}*\n\n"
        f"Please arrive 10 minutes early. Reply *cancel* if you need to reschedule. 🙏"
    )

    await send_text(tenant.wa_phone_number_id, tenant.wa_access_token, appt.patient_phone, message)

    appt.reminder_sent = True
    await db.commit()
    return {"message": "Reminder sent"}


class RescheduleRequest(BaseModel):
    date: str
    time: str


@router.patch("/{appointment_id}/reschedule")
async def reschedule_appointment(
    appointment_id: str,
    body: RescheduleRequest,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.tenant_id == tenant.id,
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    dt_str = f"{body.date} {body.time}"
    appt.appointment_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M").replace(tzinfo=IST)
    appt.status = "confirmed"
    appt.reminder_sent = False
    await db.commit()

    from app.services.whatsapp import send_text
    dt = appt.appointment_dt.astimezone(IST)
    date_str = dt.strftime("%d %B %Y")
    time_str = dt.strftime("%I:%M %p")

    message = (
        f"Hello {appt.patient_name or 'there'}! 👋\n\n"
        f"Your appointment at *{tenant.name}* has been rescheduled.\n\n"
        f"📅 New Date: *{date_str}*\n"
        f"🕐 New Time: *{time_str}*\n"
        f"🏥 Service: *{appt.service or 'General Checkup'}*\n\n"
        f"Reply *help* to get clinic contact no. 🙏"
    )
    await send_text(tenant.wa_phone_number_id, tenant.wa_access_token, appt.patient_phone, message)

    return {"message": "Appointment rescheduled"}