from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from app.db.database import get_db
from app.dependencies import get_current_tenant
from app.models.tenant import Tenant
from app.models.timeslot import TimeSlot

import uuid

router = APIRouter()

DAYS_LIST = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


class SlotsUpdate(BaseModel):
    schedule: dict


def _expand_range(from_str: str, to_str: str) -> list[str]:
    """Expand HH:MM range into list of HH:MM slot strings at 30-min intervals."""
    slots = []
    if not from_str or not to_str:
        return slots
    try:
        fh, fm = map(int, from_str.split(":"))
        th, tm = map(int, to_str.split(":"))
        end_mins = th * 60 + tm
        while fh * 60 + fm < end_mins:
            slots.append(f"{fh:02d}:{fm:02d}")
            fm += 30
            if fm >= 60:
                fh += 1
                fm = 0
    except Exception:
        pass
    return slots


@router.get("/")
async def get_slots(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    # Return working_hours directly — it has the exact ranges the frontend saved
    # This avoids reconstructing ranges from individual slot rows (which is error-prone)
    return tenant.working_hours or {}


@router.put("/")
async def update_slots(
    body: SlotsUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    # Wipe existing slots for this tenant
    await db.execute(
        delete(TimeSlot).where(TimeSlot.tenant_id == tenant.id)
    )

    new_slots = []
    for day_name, day_data in body.schedule.items():
        if day_name not in DAYS_LIST:
            continue
        dow = DAYS_LIST.index(day_name)

        if not day_data.get("open"):
            continue

        for doctor in day_data.get("doctors", []):
            doc_name = (doctor.get("name") or "").strip() or "Doctor"
            for range_ in doctor.get("ranges", []):
                from_str = range_.get("from", "")
                to_str   = range_.get("to", "")
                slot_times = _expand_range(from_str, to_str)
                for t in slot_times:
                    new_slots.append(TimeSlot(
                        id=str(uuid.uuid4()),
                        tenant_id=tenant.id,
                        day_of_week=dow,
                        time_str=t,           # HH:MM for correct sorting
                        doctor_name=doc_name,
                        is_active=True,
                    ))

    db.add_all(new_slots)

    # Save original schedule as-is for GET to return
    tenant.working_hours = body.schedule
    await db.commit()

    return {"message": "Slots updated", "slots_saved": len(new_slots)}
