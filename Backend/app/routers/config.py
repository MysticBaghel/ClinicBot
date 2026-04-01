from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional, List

from app.db.database import get_db
from app.dependencies import get_current_tenant
from app.models.tenant import Tenant

router = APIRouter()


class ConfigUpdate(BaseModel):
    system_prompt: Optional[str] = None
    services: Optional[List[str]] = None


@router.get("/")
async def get_config(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    return {
        "name": tenant.name,
        "system_prompt": tenant.system_prompt or "",
        "services": tenant.services or [],
    }


@router.put("/")
async def update_config(
    body: ConfigUpdate,
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    if body.system_prompt is not None:
        tenant.system_prompt = body.system_prompt
    if body.services is not None:
        tenant.services = body.services
    await db.commit()
    return {"message": "Config updated"}