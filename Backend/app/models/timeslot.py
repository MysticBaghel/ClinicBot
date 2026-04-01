import uuid
from sqlalchemy import String, Boolean, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class TimeSlot(Base):
    __tablename__ = "timeslots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id: Mapped[str] = mapped_column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Mon, 6=Sun
    time_str: Mapped[str] = mapped_column(String, nullable=False)      # e.g. "10:00 AM"
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    doctor_name: Mapped[str] = mapped_column(String, nullable=True)    # e.g. "Dr. Smith"
