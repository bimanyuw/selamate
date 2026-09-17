"""Rule-based environment risk with explicit physical units."""
from .behavior import _number, _risk_level


def score_environment(rainfall, visibility, road_condition, slope, disaster_risk):
    """Rainfall mm/h, visibility metres, signed slope degrees, disaster risk 0–100."""
    rainfall = _number("rainfall", rainfall)
    visibility = _number("visibility", visibility)
    slope = _number("slope", slope, -90, 90)
    disaster_risk = _number("disaster_risk", disaster_risk, 0, 100)
    roads = {"dry": 0, "wet": 40, "damaged": 70, "flooded": 100, "icy": 100}
    if not isinstance(road_condition, str) or road_condition.lower() not in roads:
        raise ValueError(f"road_condition must be one of {', '.join(roads)}")
    scores = {"rainfall": min(100, rainfall * 2), "visibility": max(0, 100 * (1 - visibility / 1000)), "road_condition": roads[road_condition.lower()], "slope": min(100, abs(slope) / 15 * 100), "disaster_risk": disaster_risk}
    weights = {"rainfall": .2, "visibility": .25, "road_condition": .2, "slope": .1, "disaster_risk": .25}
    contributions = {name: value * weights[name] for name, value in scores.items()}
    score = round(sum(contributions.values()), 2)
    return {"environment_score": score, "risk_level": _risk_level(score), "details": {"component_scores": scores, "weights": weights, "contributions": contributions}}
