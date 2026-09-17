from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    region: str
    hazard: str
    level: Literal["Waspada", "Siaga", "Awas"]
    description: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    is_simulation: bool = True


class AlertsResponse(BaseModel):
    source: Literal["simulation", "database"]
    alerts: list[AlertResponse]
