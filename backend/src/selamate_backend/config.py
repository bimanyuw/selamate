from pathlib import Path
from typing import Literal
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    data_source: Literal["simulation", "database"] = "simulation"
    cors_origins: list[str] = Field(default_factory=list)
    auth_cookie_secure: bool = False
    auth_cookie_samesite: Literal["lax", "strict", "none"] = "lax"
    auth_session_seconds: int = Field(default=7 * 24 * 60 * 60, ge=60, le=30 * 24 * 60 * 60)
    fatigue_max_upload_bytes: int = Field(default=100 * 1024 * 1024, gt=0)
    fatigue_max_video_seconds: float = Field(default=300, gt=0, allow_inf_nan=False)
    database_url: str = "postgresql+psycopg://selamate:selamate_dev@localhost:5432/selamate"


settings = Settings()
