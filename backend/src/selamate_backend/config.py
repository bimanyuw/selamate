from pathlib import Path
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    data_source: Literal["simulation", "database"] = "simulation"
    database_url: str = "postgresql+psycopg://selamate:selamate_dev@localhost:5432/selamate"


settings = Settings()
