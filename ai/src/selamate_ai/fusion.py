"""Fuse validated 0–100 scores; missing data is never treated as zero."""
from .behavior import _number, _risk_level


def fuse_risk(fatigue_score, behavior_score, environment_score):
    scores = {"fatigue": fatigue_score, "behavior": behavior_score, "environment": environment_score}
    weights = {"fatigue": .5, "behavior": .3, "environment": .2}
    breakdown = {}
    for name, value in scores.items():
        value = _number(f"{name}_score", value, 0, 100)
        breakdown[name] = {"score": value, "weight": weights[name], "contribution": value * weights[name]}
    score = round(sum(item["contribution"] for item in breakdown.values()), 2)
    dominant = max(breakdown, key=lambda name: breakdown[name]["contribution"]) if score else "none"
    level = _risk_level(score)
    warnings = {"fatigue": "Stop in a safe place and rest.", "behavior": "Reduce speed and avoid abrupt manoeuvres.", "environment": "Slow down and reassess road and weather conditions."}
    warning = "Continue monitoring driving conditions." if level == "LOW" else warnings[dominant]
    return {"overall_risk_score": score, "risk_level": level, "dominant_factor": dominant, "warning": warning, "component_breakdown": breakdown}
