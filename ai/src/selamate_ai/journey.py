"""Transparent demo heuristics. Scores are indices, not accident probabilities."""
import math
from .behavior import score_behavior, _risk_level
from .environment import score_environment


def distance_km(lat1, lon1, lat2, lon2):
    a, b = math.radians(lat1), math.radians(lat2)
    dlat, dlon = b - a, math.radians(lon2 - lon1)
    h = math.sin(dlat / 2) ** 2 + math.cos(a) * math.cos(b) * math.sin(dlon / 2) ** 2
    return 6371 * 2 * math.asin(math.sqrt(min(1, max(0, h))))


def include_fatigue(result, fatigue_score=None):
    """Raise journey risk by fatigue's fraction of remaining headroom.

    This bounded heuristic is an index, not a probability. Coverage weights
    describe available inputs, not the nonlinear score formula. Missing camera
    evidence leaves a partial journey score; it never implies an alert driver.
    """
    base = result["overall_risk_score"]
    result["journey_only_score"] = base
    result["fusion_method"] = "remaining_headroom"
    coverage = result["coverage"] / 200
    for component in result["components"].values():
        component["weight"] *= .5
    if fatigue_score is None:
        result["missing_components"].append("fatigue")
    else:
        if not math.isfinite(fatigue_score) or not 0 <= fatigue_score <= 100:
            raise ValueError("Fatigue score must be finite and between 0 and 100")
        coverage += .5
        result["components"]["fatigue"] = {"score": round(fatigue_score, 1), "weight": .5}
        combined = fatigue_score if base is None else base + (100 - base) * fatigue_score / 100
        result["overall_risk_score"] = round(combined, 1)
        result["risk_level"] = _risk_level(combined)
        if fatigue_score >= 70:
            result["reasons"].insert(0, "Kantuk berat terdeteksi dari kamera; segera berhenti di tempat aman.")
        elif fatigue_score >= 40:
            result["reasons"].insert(0, "Tanda kantuk terdeteksi dari kamera; rencanakan istirahat.")
        elif fatigue_score > 0:
            result["reasons"].insert(0, "Durasi mata tertutup meningkatkan skor bahaya perjalanan.")
    for component in result["components"].values():
        component["effective_weight"] = round(component["weight"] / coverage, 4) if coverage else 0
    result["coverage"] = round(coverage * 100)
    return result


def score_journey(telemetry, hazards=None):
    weights = {"environment": .35, "behavior": .30, "vehicle": .20, "gps": .15}
    scores, reasons, floors, nearby = {}, [], [], []
    env, driving = telemetry.get("environment"), telemetry.get("behavior")
    if env is not None:
        scores["environment"] = score_environment(**env)["environment_score"]
        if env["rainfall"] >= 20:
            reasons.append("Hujan lebat; kurangi kecepatan dan tambah jarak aman.")
        if env["visibility"] < 300:
            reasons.append("Jarak pandang rendah.")
        if env["road_condition"] in {"flooded", "icy"}:
            floors.append(70)
            reasons.append("Jalan tergenang atau berlapis es; cari tempat aman dan evaluasi rute.")
        elif env["road_condition"] != "dry":
            reasons.append("Permukaan jalan " + {"wet": "basah", "damaged": "rusak"}[env["road_condition"]] + ".")
        if scores["environment"] >= 70:
            floors.append(70)
    if driving is not None:
        scores["behavior"] = score_behavior(**driving)["behavior_score"]
        ratio = driving["speed"] / driving["speed_limit"]
        if ratio > 1:
            floors.append(70 if ratio >= 1.3 else 40)
            reasons.append(f"Kecepatan {driving['speed']:g} km/jam melebihi batas {driving['speed_limit']:g} km/jam.")
        if env and (env["rainfall"] >= 20 or env["visibility"] < 300) and driving["speed"] > 40:
            floors.append(70)
            reasons.append("Kecepatan tinggi bersamaan dengan hujan lebat atau jarak pandang rendah.")
        if any(driving.get(key, 0) for key in ("harsh_braking", "harsh_acceleration", "sharp_turns")):
            reasons.append("Terdapat manuver mendadak pada data kendaraan.")
    vehicle = []
    fuel, rpm, temp = (telemetry.get(key) for key in ("fuel_level", "rpm", "engine_temperature"))
    if fuel is not None:
        vehicle.append(100 if fuel <= 5 else 70 if fuel <= 10 else 40 if fuel <= 25 else 0)
        if fuel <= 25:
            floors.append(70 if fuel <= 5 else 40)
            reasons.append(f"Bahan bakar tinggal {fuel:g}%; rencanakan pengisian.")
    if rpm is not None:
        vehicle.append(80 if rpm >= 6000 else 40 if rpm >= 4500 else 0)
        if rpm >= 4500:
            reasons.append("RPM mesin tinggi.")
    if temp is not None:
        vehicle.append(100 if temp >= 110 else 50 if temp >= 100 else 0)
        if temp >= 100:
            floors.append(70 if temp >= 110 else 40)
            reasons.append("Suhu mesin tinggi.")
    if vehicle:
        scores["vehicle"] = max(vehicle)
    lat, lon, accuracy = (telemetry.get(key) for key in ("latitude", "longitude", "accuracy"))
    if lat is not None and lon is not None and accuracy is not None and accuracy <= 100 and hazards is not None:
        for hazard in hazards:
            distance = distance_km(lat, lon, hazard["latitude"], hazard["longitude"])
            if distance <= 5:
                severity = {"Waspada": 40, "Siaga": 70, "Awas": 100}[hazard["level"]]
                nearby.append({**hazard, "distance_km": round(distance, 2), "proximity_score": severity * (1 - distance / 5)})
        nearby.sort(key=lambda item: item["distance_km"])
        scores["gps"] = max((item["proximity_score"] for item in nearby), default=0)
        for item in nearby[:3]:
            reasons.append(f"{'Titik bahaya simulasi' if item['is_simulation'] else 'Titik bahaya'}: {item['hazard']} ({item['distance_km']:g} km).")
        if scores["gps"] >= 70:
            floors.append(70)
    coverage = sum(weights[key] for key in scores)
    score = round(max(sum(scores[key] * weights[key] for key in scores) / coverage, max(floors, default=0)), 1) if coverage else None
    return {
        "overall_risk_score": score, "risk_level": _risk_level(score) if score is not None else None,
        "method": "algorithm", "coverage": round(coverage * 100),
        "missing_components": [key for key in weights if key not in scores],
        "components": {key: {"score": round(value, 1), "weight": weights[key], "effective_weight": round(weights[key] / coverage, 4)} for key, value in scores.items()},
        "reasons": reasons, "nearby_hazards": nearby,
        "safety_floor": max(floors, default=0),
    }
