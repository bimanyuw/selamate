from sqlalchemy import Boolean, Float, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class Alert(Base):
    __tablename__ = "alerts"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    region: Mapped[str] = mapped_column(String(128))
    hazard: Mapped[str] = mapped_column(String(128))
    level: Mapped[str] = mapped_column(String(32))
    description: Mapped[str] = mapped_column(Text)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    is_simulation: Mapped[bool] = mapped_column(Boolean, default=True)
