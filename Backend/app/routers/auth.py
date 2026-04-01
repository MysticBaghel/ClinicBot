from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse, TenantInfo, RefreshRequest
from app.services.auth import (
    verify_password, create_access_token, create_refresh_token,
    decode_token, get_tenant_by_phone, get_tenant_by_id,
)

router = APIRouter()
bearer_scheme = HTTPBearer()


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    tenant = await get_tenant_by_phone(body.phone, db)

    if not tenant or not verify_password(body.password, tenant.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid phone or password.")

    if not tenant.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive.")

    return TokenResponse(
        access_token=create_access_token(tenant.id),
        refresh_token=create_refresh_token(tenant.id),
        tenant=TenantInfo.model_validate(tenant),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, db: AsyncSession = Depends(get_db)):
    tenant_id = decode_token(body.refresh_token, expected_type="refresh")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token.")

    tenant = await get_tenant_by_id(tenant_id, db)
    if not tenant or not tenant.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tenant not found.")

    return TokenResponse(
        access_token=create_access_token(tenant.id),
        refresh_token=body.refresh_token,
        tenant=TenantInfo.model_validate(tenant),
    )


@router.post("/logout", status_code=200)
async def logout():
    return {"message": "Logged out."}


@router.get("/me", response_model=TenantInfo)
async def get_me(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
):
    tenant_id = decode_token(credentials.credentials, expected_type="access")
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token.")

    tenant = await get_tenant_by_id(tenant_id, db)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tenant not found.")

    return TenantInfo.model_validate(tenant)