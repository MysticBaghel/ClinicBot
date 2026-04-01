import uuid
from sqlalchemy import String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class Appointment(Base):
    __tablename__ = "appointments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), nullable=False, index=True)

    patient_phone: Mapped[str] = mapped_column(String, nullable=False)
    patient_name: Mapped[str] = mapped_column(String, nullable=True)
    service: Mapped[str] = mapped_column(String, nullable=True)
    appointment_dt: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    status: Mapped[str] = mapped_column(String, default="pending")
    reminder_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())