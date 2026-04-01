import hmac
import hashlib
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, Header, Depends, BackgroundTasks
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import engine, Base, get_db
from app.models.tenant import Tenant
from app.schemas.webhook import WhatsAppWebhookPayload
from app.tasks.process import process_incoming_message   
from app.routers import admin
from app.routers import auth
from app.routers import dashboard
from app.routers import appointments
from app.routers import slots
from app.routers import config
from dotenv import load_dotenv
from app.models.session_model import Session
from app.routers import clinic

load_dotenv()


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


# ── App init ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="WhatsApp Bot Backend",
    description="Multi-tenant WhatsApp chatbot backend",
    version="0.1.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(admin.router,        prefix="/admin",        tags=["Admin"])
app.include_router(auth.router,         prefix="/auth",         tags=["Auth"])
app.include_router(dashboard.router,    prefix="/dashboard",    tags=["Dashboard"])
app.include_router(appointments.router, prefix="/appointments", tags=["Appointments"])
app.include_router(slots.router,        prefix="/slots",        tags=["Slots"])
app.include_router(config.router,       prefix="/config",       tags=["Config"])
app.include_router(clinic.router, prefix="/clinic", tags=["Clinic"])


# ── Helpers ───────────────────────────────────────────────────────────────────
def verify_whatsapp_signature(payload_bytes: bytes, signature_header: str, secret: str) -> bool:
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), payload_bytes, hashlib.sha256).hexdigest()
    received = signature_header.split("sha256=")[1]
    return hmac.compare_digest(expected, received)


async def get_tenant_or_404(tenant_id: str, db: AsyncSession) -> Tenant:
    from sqlalchemy import select
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


# ── Webhook verification (GET) ────────────────────────────────────────────────
@app.get("/webhook/{tenant_id}")
async def verify_webhook(tenant_id: str, request: Request, db: AsyncSession = Depends(get_db)):
    tenant = await get_tenant_or_404(tenant_id, db)
    mode      = request.query_params.get("hub.mode")
    token     = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    if mode == "subscribe" and token == tenant.verify_token:
        return PlainTextResponse(challenge)
    raise HTTPException(status_code=403, detail="Verification failed")


# ── Webhook receiver (POST) ───────────────────────────────────────────────────
@app.post("/webhook/{tenant_id}")
async def receive_webhook(
    tenant_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    x_hub_signature_256: str = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    tenant = await get_tenant_or_404(tenant_id, db)

    raw_body = await request.body()
    if not verify_whatsapp_signature(raw_body, x_hub_signature_256, tenant.webhook_secret):
        raise HTTPException(status_code=403, detail="Invalid signature")

    try:
        payload = WhatsAppWebhookPayload.model_validate_json(raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")

    for entry in payload.entry:
        for change in entry.changes:
            if change.field != "messages":
                continue
            value = change.value
            for msg in (value.messages or []):
                if msg.type == "text" and msg.text:
                    text = msg.text.body
                elif msg.type == "interactive" and msg.interactive:
                    if msg.interactive.type == "button_reply":
                        text = msg.interactive.button_reply.title
                    elif msg.interactive.type == "list_reply":
                        text = msg.interactive.list_reply.title
                    else:
                        text = None
                else:
                    text = None

                # Replaces: process_incoming_message.delay(...)
                background_tasks.add_task(
                    process_incoming_message,
                    tenant_id=tenant_id,
                    sender_phone=msg.from_,
                    message_id=msg.id,
                    message_type="text",
                    text=text,
                )

    return JSONResponse({"status": "ok"})


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "alive"}
