import uuid
from sqlalchemy import String, Boolean, JSON, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    password: Mapped[str] = mapped_column(String, nullable=False)
    wa_phone_number_id: Mapped[str] = mapped_column(String, nullable=False)
    wa_access_token: Mapped[str] = mapped_column(String, nullable=False)
    verify_token: Mapped[str] = mapped_column(String, nullable=False)
    webhook_secret: Mapped[str] = mapped_column(String, nullable=False)
    system_prompt: Mapped[str] = mapped_column(String, nullable=True)
    working_hours: Mapped[dict] = mapped_column(JSON, default=dict)
    services: Mapped[list] = mapped_column(JSON, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Excel file storage — raw base64 + original filename
    excel_file: Mapped[str] = mapped_column(Text, nullable=True)       # base64-encoded .xlsx bytes
    excel_filename: Mapped[str] = mapped_column(String, nullable=True) # original filename e.g. "clinic_setup.xlsx"
