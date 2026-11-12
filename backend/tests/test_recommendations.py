from fastapi.testclient import TestClient

from app.main import app
from app.services.profit_recommendations import (
    OPERATIONAL_TYPES,
    profit_aware_recommendations,
    forecast_stockout_recommendations,
)

STAFF = ("staff@lusakawholesale.zm", "StaffPass123!")
OWNER = ("owner@lusakawholesale.zm", "OwnerPass123!")
MANAGER = ("manager@lusakawholesale.zm", "ManagerPass123!")

REQUIRED_FIELDS = (
    "id",
    "title",
    "explanation",
    "suggested_action",
    "period",
    "affected_entity",
    "metrics",
    "data_quality",
)


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_high_demand_low_margin_requires_snapshotted_profit():
    performance = [
        {
            "product_id": 1,
            "product_name": "Bulk Rice",
            "sku": "RICE-1",
            "units_sold": 100,
            "revenue": 1000,
            "sales_velocity": 10,
            "observed_days": 10,
        },
        {
            "product_id": 2,
            "product_name": "No Cost History",
            "sku": "NONE",
            "units_sold": 90,
            "revenue": 900,
            "sales_velocity": 9,
            "observed_days": 10,
        },
    ]
    profit = {
        "available": True,
        "products": [
            {
                "product_id": 1,
                "product_name": "Bulk Rice",
                "sku": "RICE-1",
                "units_sold": 100,
                "revenue": 1000,
                "cogs": 900,
                "gross_profit": 100,
                "gross_margin_pct": 10.0,
            }
        ],
    }
    recs = profit_aware_recommendations(performance, profit, "2026-10-07 to 2026-11-05")
    types = {item["type"] for item in recs}
    ids = {item["affected_entity"]["id"] for item in recs}
    assert "high_demand_low_margin" in types
    assert 1 in ids
    assert 2 not in ids
    assert all(item["suggested_action"] for item in recs)
    assert all(item["data_quality"]["has_sufficient_data"] in (True, False) for item in recs)


def test_profit_rules_skip_when_costs_unavailable():
    recs = profit_aware_recommendations(
        [{"product_id": 1, "product_name": "A", "sku": "A", "units_sold": 10, "revenue": 50, "sales_velocity": 1, "observed_days": 5}],
        {"available": False, "products": []},
        "2026-10-07 to 2026-11-05",
    )
    assert recs == []


def test_forecast_stockout_is_advisory_and_not_a_reorder_point():
    recs = forecast_stockout_recommendations(
        [
            {
                "productId": 9,
                "productName": "Beef Mince 500g",
                "productSku": "BEEF-001",
                "currentQuantity": 0,
                "forecastDailyDemand": 7,
                "horizonDemand": 98,
                "estimatedDaysUntilStockout": 0,
                "suggestedRestockQuantity": 59,
                "urgency": "HIGH",
                "dataSufficient": False,
            }
        ],
        14,
        "next 14 days",
    )
    assert len(recs) == 1
    assert recs[0]["metrics"]["reorder_reliable"] is False
    assert "restock" in recs[0]["suggested_action"].lower()


def test_staff_cannot_access_recommendations_module():
    client = TestClient(app)
    headers = _login(client, *STAFF)
    response = client.get("/api/recommendations", headers=headers)
    assert response.status_code == 403


def test_owner_recommendations_are_explainable():
    client = TestClient(app)
    headers = _login(client, *OWNER)
    response = client.get("/api/recommendations?months=6", headers=headers)
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["total_recommendations"] == len(payload["recommendations"])
    assert any("do not automatically change stock" in note.lower() for note in payload["limitations"])
    for rec in payload["recommendations"]:
        for field in REQUIRED_FIELDS:
            assert rec.get(field) not in (None, ""), field
        assert rec["data_quality"]["has_sufficient_data"] in (True, False)
        assert rec["affected_entity"]["name"] or rec["affected_entity"]["type"] == "business"


def test_manager_receives_operational_recommendations_only():
    client = TestClient(app)
    owner_headers = _login(client, *OWNER)
    manager_headers = _login(client, *MANAGER)
    owner = client.get("/api/recommendations", headers=owner_headers)
    manager = client.get("/api/recommendations", headers=manager_headers)
    assert owner.status_code == 200, owner.text
    assert manager.status_code == 200, manager.text
    manager_types = {item["type"] for item in manager.json()["recommendations"]}
    assert manager_types <= OPERATIONAL_TYPES
    for item in manager.json()["recommendations"]:
        assert item.get("audience") == "operational"
