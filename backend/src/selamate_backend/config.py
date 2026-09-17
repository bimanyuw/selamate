from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    data_source: Literal["simulation", "database"] = "simulation"
    database_url: str = "postgresql+psycopg://selamate:selamate_dev@localhost:5432/selamate"
    session_secret: str = "selamate-development-secret-change-in-production"
    admin_email: str = "admin@selamate.id"
    admin_password: str = "Admin123!"
    driver_email: str = "driver@selamate.id"
    driver_password: str = "Driver123!"


settings = Settings()
