from selamate_ai.journey import distance_km, score_journey


def telemetry(**changes):
    return {"environment": {"rainfall": 0, "visibility": 2000, "road_condition": "dry", "slope": 0, "disaster_risk": 0},
            "behavior": {"speed": 40, "speed_limit": 60}, "rpm": 2000, "fuel_level": 70,
            "engine_temperature": 90, "latitude": -6.2088, "longitude": 106.8456, "accuracy": 10, **changes}


def test_complete_safe_and_missing_data():
    safe = score_journey(telemetry(), [])
    assert safe["overall_risk_score"] == 0
    assert safe["coverage"] == 100
    assert safe["risk_level"] == "LOW"
    missing = score_journey({}, [])
    assert missing["overall_risk_score"] is None
    assert missing["risk_level"] is None
    assert missing["coverage"] == 0


def test_gps_uses_distance_and_ignores_inaccurate_positions():
    hazard = {"id": "one", "latitude": -6.2088, "longitude": 106.8456,
              "hazard": "Banjir", "level": "Awas", "is_simulation": True}
    close = score_journey(telemetry(), [hazard])
    assert close["risk_level"] == "HIGH"
    assert close["nearby_hazards"][0]["distance_km"] == 0
    assert "simulasi" in close["reasons"][0]
    far = score_journey(telemetry(latitude=-7), [hazard])
    assert far["nearby_hazards"] == []
    poor = score_journey(telemetry(accuracy=101), [hazard])
    assert "gps" in poor["missing_components"]
    unavailable = score_journey(telemetry(), None)
    assert "gps" in unavailable["missing_components"]
    assert 110 < distance_km(0, 0, 0, 1) < 112


def test_critical_factors_are_not_diluted_by_safe_components():
    for data in (telemetry(behavior={"speed": 80, "speed_limit": 60}),
                 telemetry(engine_temperature=110), telemetry(fuel_level=5),
                 telemetry(environment={"rainfall": 0, "visibility": 2000, "road_condition": "flooded", "slope": 0, "disaster_risk": 0})):
        risk = score_journey(data, [])
        assert risk["risk_level"] == "HIGH"
        assert risk["safety_floor"] >= 70
        assert risk["reasons"]
    assert score_journey(telemetry(fuel_level=23), [])["risk_level"] == "MEDIUM"


def test_weather_speed_interaction_and_partial_data():
    rain = {"rainfall": 35, "visibility": 150, "road_condition": "wet", "slope": 8, "disaster_risk": 45}
    assert score_journey(telemetry(environment=rain), [])["risk_level"] != "HIGH"
    fast = score_journey(telemetry(environment=rain, behavior={"speed": 48, "speed_limit": 60}), [])
    assert fast["risk_level"] == "HIGH"
    partial = score_journey({"fuel_level": 23}, [])
    assert partial["overall_risk_score"] == 40
    assert partial["coverage"] == 20
    assert partial["components"]["vehicle"]["effective_weight"] == 1
