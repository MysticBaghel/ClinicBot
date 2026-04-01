from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
import uuid

from app.db.database import get_db
from app.models.tenant import Tenant
from app.services.auth import hash_password

router = APIRouter()


class TenantCreate(BaseModel):
    name: str
    phone: str
    password: str
    wa_phone_number_id: str
    wa_access_token: str
    verify_token: str
    webhook_secret: str
    system_prompt: Optional[str] = None
    working_hours: Optional[dict] = {}
    services: Optional[list] = []

class TenantOut(BaseModel):
    id: str
    name: str
    phone: str
    wa_phone_number_id: str
    is_active: bool

    model_config = {"from_attributes": True}


@router.post("/tenants", response_model=TenantOut)
async def create_tenant(data: TenantCreate, db: AsyncSession = Depends(get_db)):
    hashed = hash_password(data.password)
    tenant = Tenant(
        id=str(uuid.uuid4()),
        name=data.name,
        phone=data.phone,
        password=hashed,
        wa_phone_number_id=data.wa_phone_number_id,
        wa_access_token=data.wa_access_token,
        verify_token=data.verify_token,
        webhook_secret=data.webhook_secret,
        system_prompt=data.system_prompt,
        working_hours=data.working_hours or {},
        services=data.services or [],
    )
    db.add(tenant)
    await db.commit()
    await db.refresh(tenant)
    return tenant


@router.get("/tenants", response_model=List[TenantOut])
async def list_tenants(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant))
    return result.scalars().all()


@router.get("/tenants/{tenant_id}", response_model=TenantOut)
async def get_tenant(tenant_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant