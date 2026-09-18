from sqlalchemy import BigInteger, Boolean, Float, ForeignKey, String, Text
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


class User(Base):
    __tablename__ = "users"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(254), unique=True)
    password_hash: Mapped[str] = mapped_column(Text)
    role: Mapped[str] = mapped_column(String(16), default="Driver", server_default="Driver")


class AuthSession(Base):
    __tablename__ = "auth_sessions"
    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[int] = mapped_column(BigInteger, index=True)


class WarningIncident(Base):
    __tablename__ = "warning_incidents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    driver_id: Mapped[str] = mapped_column(String(36))
    driver_name: Mapped[str] = mapped_column(String(120))
    cause: Mapped[str] = mapped_column(String(24))
    initial_level: Mapped[int]
    level: Mapped[int]
    state: Mapped[str] = mapped_column(String(24), index=True)
    created_at: Mapped[float] = mapped_column(Float)
    updated_at: Mapped[float] = mapped_column(Float, index=True)
    deadline: Mapped[float | None] = mapped_column(Float)
    responded_at: Mapped[float | None] = mapped_column(Float)
    response: Mapped[str | None] = mapped_column(String(24))
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    risk_score: Mapped[float | None] = mapped_column(Float)
    rest_name: Mapped[str] = mapped_column(String(120))


class WarningEvent(Base):
    __tablename__ = "warning_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    incident_id: Mapped[str] = mapped_column(ForeignKey("warning_incidents.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[float] = mapped_column(Float)
    level: Mapped[int]
    kind: Mapped[str] = mapped_column(String(32))
    message: Mapped[str] = mapped_column(String(500))
