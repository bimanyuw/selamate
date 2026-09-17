from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt


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


class AIRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class BehaviorRequest(AIRequest):
    speed: float = Field(ge=0)
    speed_limit: float = Field(gt=0)
    harsh_braking: StrictInt | StrictBool = Field(default=0, ge=0)
    harsh_acceleration: StrictInt | StrictBool = Field(default=0, ge=0)
    sharp_turns: StrictInt | StrictBool = Field(default=0, ge=0)


class EnvironmentRequest(AIRequest):
    rainfall: float = Field(ge=0)
    visibility: float = Field(ge=0)
    road_condition: Literal["dry", "wet", "damaged", "flooded", "icy"]
    slope: float = Field(ge=-90, le=90)
    disaster_risk: float = Field(ge=0, le=100)


class RiskRequest(AIRequest):
    fatigue_score: float = Field(ge=0, le=100)
    behavior_score: float = Field(ge=0, le=100)
    environment_score: float = Field(ge=0, le=100)
