import uuid
from sqlalchemy import String, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), nullable=False, index=True)

    phone: Mapped[str] = mapped_column(String, nullable=False, index=True)
    direction: Mapped[str] = mapped_column(String, nullable=False)  # "in" or "out"
    content: Mapped[str] = mapped_column(Text, nullable=True)
    intent: Mapped[str] = mapped_column(String, nullable=True)
    wa_message_id: Mapped[str] = mapped_column(String, nullable=True)

    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())