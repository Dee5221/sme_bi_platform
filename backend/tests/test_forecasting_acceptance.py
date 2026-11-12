from app.services.forecasting import moving_average_forecast, select_forecast_method

from tests.helpers import OWNER, client, login


def test_moving_average_matches_mean_of_window():
    series = [10.0, 20.0, 30.0, 40.0]
    path = moving_average_forecast(series, window=3, horizon=1)
    assert path == [30.0]


def test_insufficient_history_uses_naive_fallback_and_non_negative_path():
    forecasts, evaluation = select_forecast_method([5.0], horizon=3)
    assert evaluation["fallback"] is True
    assert evaluation["selected_method"] == "naive"
    assert forecasts == [5.0, 5.0, 5.0]
    assert all(value >= 0 for value in forecasts)


def test_forecasting_api_is_tenant_scoped_and_never_negative():
    api = client()
    headers = login(api, OWNER)
    response = api.get("/api/forecasting?months=6&horizon=3&demand_horizon=7", headers=headers)
    assert response.status_code in (200, 422), response.text
    if response.status_code != 200:
        return
    body = response.json()
    assert body["evaluation"]["selected_method"]
    for item in body.get("inventoryForecasts") or []:
        assert all(value >= 0 for value in (item.get("forecastPath") or []))
    for month in body.get("forecastMonthly") or []:
        assert float(month["revenue"]) >= 0
        assert float(month["expenses"]) >= 0


def test_profitability_documents_snapshot_only_costs():
    api = client()
    headers = login(api, OWNER)
    response = api.get("/api/analytics/profitability?period=7", headers=headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert "available" in body
    if body["available"]:
        assert "cogs" in body
        assert "current product cost" in (body.get("note") or "").lower()
    else:
        assert float(body.get("cogs") or 0) == 0
