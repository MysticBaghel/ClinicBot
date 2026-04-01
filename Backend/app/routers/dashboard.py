from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timezone, timedelta

from app.db.database import get_db
from app.models.appointment import Appointment
from app.dependencies import get_current_tenant
from app.models.tenant import Tenant

router = APIRouter()

IST = timezone(timedelta(hours=5, minutes=30))


@router.get("/")
async def get_dashboard(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    today = datetime.now(IST).date()

    result = await db.execute(
        select(Appointment).where(
            Appointment.tenant_id == tenant.id,
            func.date(Appointment.appointment_dt) == today,
        )
    )
    todays = result.scalars().all()

    week_ago = datetime.now(IST) - timedelta(days=7)
    result2 = await db.execute(
        select(func.count()).where(
            Appointment.tenant_id == tenant.id,
            Appointment.created_at >= week_ago,
        )
    )
    new_this_week = result2.scalar()

    result3 = await db.execute(
        select(func.count()).where(
            Appointment.tenant_id == tenant.id,
            Appointment.reminder_sent == True,
        )
    )
    reminders_sent = result3.scalar()

    month_start = datetime.now(IST).replace(day=1, hour=0, minute=0, second=0)
    result4 = await db.execute(
        select(func.count()).where(
            Appointment.tenant_id == tenant.id,
            Appointment.created_at >= month_start,
        )
    )
    this_month = result4.scalar()

    confirmed_today = [a for a in todays if a.status == "confirmed"]

    return {
        "todayAppointments": len(todays),
        "confirmedToday": len(confirmed_today),
        "newPatientsWeek": new_this_week,
        "remindersSent": reminders_sent,
        "thisMonth": this_month,
        "todaySchedule": [
            {
                "id": a.id,
                "patientName": a.patient_name or "Unknown",
                "patientPhone": a.patient_phone,
                "service": a.service or "General",
                "time": a.appointment_dt.astimezone(IST).strftime("%I:%M %p") if a.appointment_dt else "—",
                "status": a.status,
                "reminderSent": a.reminder_sent,
                "avatar": "".join(w[0] for w in (a.patient_name or "UN").split()[:2]).upper(),
            }
            for a in sorted(todays, key=lambda x: x.appointment_dt or datetime.min.replace(tzinfo=IST))
        ],
    }