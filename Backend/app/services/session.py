import json
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select, delete
import os

SESSION_TTL_MINUTES = 30

def _blank_session() -> dict:
    return {
        "flow": None,
        "step": None,
        "data": {},
        "history": [],
        "handoff": False,
    }


async def _get_db() -> AsyncSession:
    from dotenv import load_dotenv
    load_dotenv()
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/clinic_db")
    engine = create_async_engine(DATABASE_URL, echo=False)
    AsyncSessionLocal = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    return AsyncSessionLocal(), engine


async def get_session(tenant_id: str, phone: str) -> dict:
    from app.models.session_model import Session

    db, engine = await _get_db()
    try:
        async with db:
            result = await db.execute(
                select(Session).where(
                    Session.tenant_id == tenant_id,
                    Session.phone == phone,
                )
            )
            row = result.scalar_one_or_none()

            if not row:
                return _blank_session()

            # Expire session if idle more than SESSION_TTL_MINUTES
            cutoff = datetime.now(timezone.utc) - timedelta(minutes=SESSION_TTL_MINUTES)
            updated = row.updated_at
            if updated.tzinfo is None:
                updated = updated.replace(tzinfo=timezone.utc)
            if updated < cutoff:
                await db.delete(row)
                await db.commit()
                return _blank_session()

            return row.data if row.data else _blank_session()
    finally:
        await engine.dispose()


async def save_session(tenant_id: str, phone: str, session: dict) -> None:
    from app.models.session_model import Session

    db, engine = await _get_db()
    try:
        async with db:
            result = await db.execute(
                select(Session).where(
                    Session.tenant_id == tenant_id,
                    Session.phone == phone,
                )
            )
            row = result.scalar_one_or_none()

            if row:
                row.data = session
                row.updated_at = datetime.now(timezone.utc)
            else:
                row = Session(
                    tenant_id=tenant_id,
                    phone=phone,
                    data=session,
                )
                db.add(row)

            await db.commit()
    finally:
        await engine.dispose()


async def clear_session(tenant_id: str, phone: str) -> None:
    from app.models.session_model import Session

    db, engine = await _get_db()
    try:
        async with db:
            await db.execute(
                delete(Session).where(
                    Session.tenant_id == tenant_id,
                    Session.phone == phone,
                )
            )
            await db.commit()
    finally:
        await engine.dispose()


def add_to_history(session: dict, text: str) -> dict:
    session["history"].append(text)
    session["history"] = session["history"][-5:]
    return session
