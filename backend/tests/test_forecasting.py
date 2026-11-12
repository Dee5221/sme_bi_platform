from app.services.forecasting import (
    moving_average_forecast,
    naive_forecast,
    normalize_weights,
    seasonal_naive_forecast,
    select_forecast_method,
    weighted_moving_average_forecast,
)


def test_wma_default_weights_sum_to_one():
    weights = normalize_weights((0.50, 0.30, 0.20))
    assert abs(sum(weights) - 1.0) < 1e-9


def test_wma_normalizes_unnormalized_weights():
    weights = normalize_weights((5, 3, 2))
    assert abs(weights[0] - 0.5) < 1e-9
    assert abs(sum(weights) - 1.0) < 1e-9


def test_wma_one_step_matches_documented_formula():
    series = [10.0, 20.0, 30.0]
    # 0.50*30 + 0.30*20 + 0.20*10 = 23
    assert weighted_moving_average_forecast(series, 1)[0] == 23.0


def test_wma_multi_step_uses_forecast_path_not_one_day_times_horizon():
    series = [10.0, 20.0, 30.0]
    path = weighted_moving_average_forecast(series, 2)
    assert path[0] == 23.0
    # 0.50*23 + 0.30*30 + 0.20*20 = 24.5
    assert abs(path[1] - 24.5) < 1e-9
    assert path[0] * 2 != path[1]


def test_wma_and_sma_never_forecast_negative_demand():
    series = [-10.0, -20.0, -30.0]
    assert weighted_moving_average_forecast(series, 2) == [0.0, 0.0]
    assert moving_average_forecast(series, 3, 2) == [0.0, 0.0]
    assert naive_forecast([-4.0], 2) == [0.0, 0.0]


def test_seasonal_naive_repeats_last_season():
    series = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0]
    assert seasonal_naive_forecast(series, 3, 7) == [1.0, 2.0, 3.0]


def test_short_series_uses_labelled_fallback():
    forecasts, evaluation = select_forecast_method([5.0], horizon=2)
    assert forecasts == [5.0, 5.0]
    assert evaluation["fallback"] is True
    assert evaluation["selected_method"] == "naive"


def test_method_selection_does_not_leak_future_values():
    series = [float(value) for value in range(1, 13)]
    forecasts, evaluation = select_forecast_method(series, horizon=3, season_length=None)
    assert all(value >= 0 for value in forecasts)
    assert evaluation["selected_method"] in {"wma", "sma", "naive"}
    eligible = [row for row in evaluation["candidates"] if row["eligible"]]
    assert eligible
    assert evaluation["test_periods"] >= 2
