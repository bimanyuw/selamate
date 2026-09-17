"""Rule-based driving risk; speeds use the same unit, events share a window."""
import math


def _number(name, value, minimum=0, maximum=None):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} must be a finite number")
    if value < minimum or (maximum is not None and value > maximum):
        raise ValueError(f"{name} is outside its allowed range")
    return float(value)


def _risk_level(score):
    return "HIGH" if score >= 70 else "MEDIUM" if score >= 40 else "LOW"


def score_behavior(speed, speed_limit, harsh_braking=0, harsh_acceleration=0, sharp_turns=0):
    speed = _number("speed", speed)
    limit = _number("speed_limit", speed_limit)
    if limit == 0:
        raise ValueError("speed_limit must be greater than zero")
    overspeed_ratio = max(0.0, speed / limit - 1)
    if not math.isfinite(overspeed_ratio):
        raise ValueError("speed / speed_limit is outside the supported numeric range")
    contributions = {"speed": min(40.0, overspeed_ratio * 80)}
    for name, value, weight, cap in (("harsh_braking", harsh_braking, 10, 25), ("harsh_acceleration", harsh_acceleration, 8, 20), ("sharp_turns", sharp_turns, 8, 15)):
        value = _number(name, int(value) if isinstance(value, bool) else value)
        if not value.is_integer():
            raise ValueError(f"{name} must be an integer count or boolean")
        contributions[name] = min(cap, value * weight)
    score = round(sum(contributions.values()), 2)
    return {"behavior_score": score, "risk_level": _risk_level(score), "details": {"contributions": contributions, "overspeed_ratio": overspeed_ratio}}
