from uuid import uuid4

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.business import Business
from app.models.role import Role
from app.models.user import User
from tests.helpers import OWNER, client, login, product_map, stock_map


def _create_isolated_owner() -> tuple[str, str, int, int]:
    db = SessionLocal()
    try:
        role = db.query(Role).filter(Role.role_name == "Business Owner").one()
        business = Business(
            name=f"Isolation Mart {uuid4().hex[:8]}",
            type="Retail",
            contact="Iso Owner",
            address="Test Plot",
            currency="ZMW",
        )
        db.add(business)
        db.flush()
        email = f"iso-{uuid4().hex[:8]}@isolation.zm"
        password = "IsoPass123!"
        user = User(
            business_id=business.id,
            role_id=role.id,
            name="Iso Owner",
            email=email,
            password_hash=get_password_hash(password),
            status="active",
        )
        db.add(user)
        db.commit()
        return email, password, business.id, user.id
    finally:
        db.close()


def test_cross_business_product_sale_and_analytics_are_denied():
    api = client()
    home = login(api, OWNER)
    products = product_map(api, home)
    sales = api.get("/api/sales/", headers=home)
    assert sales.status_code == 200
    foreign_product_id = next(iter(products))
    foreign_sale_id = sales.json()[0]["id"]
    home_summary = api.get("/api/analytics/summary", headers=home)
    assert home_summary.status_code == 200
    home_revenue = float(home_summary.json()["total_revenue"])

    email, password, _business_id, _user_id = _create_isolated_owner()
    outsider = login(api, (email, password))

    missing_product = api.patch(
        f"/api/products/{foreign_product_id}",
        headers=outsider,
        json={"name": "Hijacked"},
    )
    assert missing_product.status_code == 404

    missing_sale = api.get(f"/api/sales/{foreign_sale_id}", headers=outsider)
    assert missing_sale.status_code == 404

    outsider_products = api.get("/api/products/", headers=outsider)
    assert outsider_products.status_code == 200
    assert outsider_products.json() == []

    outsider_summary = api.get("/api/analytics/summary", headers=outsider)
    assert outsider_summary.status_code == 200
    assert float(outsider_summary.json()["total_revenue"]) == 0
    assert home_revenue >= 0
    assert float(outsider_summary.json()["total_revenue"]) != home_revenue or home_revenue == 0

    outsider_forecast = api.get("/api/forecasting", headers=outsider)
    assert outsider_forecast.status_code in (200, 422)
    if outsider_forecast.status_code == 200:
        for month in outsider_forecast.json().get("historicalMonthly") or []:
            assert float(month["revenue"]) == 0
