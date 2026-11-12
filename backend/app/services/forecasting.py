"""
Pure-Python forecasting service for SME BI Platform.

Baseline: 3-period simple moving average.
Also evaluates weighted moving average, naive, and seasonal naive.
Method selection uses rolling-origin one-step errors (no future leakage).
Demand forecasts are clamped so they are never negative.
"""
import math
from typing import Callable, Dict, List, Optional, Sequence, Tuple
from statistics import mean

DEFAULT_WMA_WEIGHTS: Tuple[float, float, float] = (0.50, 0.30, 0.20)
MIN_ROLLING_ORIGINS = 2

# Tie-break when MAE is equal: prefer the more structured eligible method.
METHOD_TIE_PRIORITY = {
    "wma": 0,
    "sma": 1,
    "seasonal_naive": 2,
    "naive": 3,
    "mean": 4,
}


def moving_average_forecast(
    series: List[float],
    window: int,
    horizon: int
) -> List[float]:
    """
    Generate forecasts using simple moving average.
    
    Args:
        series: Historical values in chronological order
        window: Number of periods to average
        horizon: Number of periods to forecast
        
    Returns:
        List of forecasted values
        
    Raises:
        ValueError: If insufficient history or invalid parameters
    """
    if len(series) < window:
        raise ValueError(
            f"Insufficient history: need at least {window} periods, "
            f"got {len(series)}"
        )
    
    if window < 1:
        raise ValueError("Window must be positive")
    
    if horizon < 1:
        raise ValueError("Horizon must be positive")
    
    forecasts = []
    working_series = series.copy()
    
    for _ in range(horizon):
        # Use the last `window` values (actual or forecasted)
        recent = working_series[-window:]
        forecast = max(0.0, sum(recent) / window)
        forecasts.append(forecast)
        # Add forecast to series for next iteration (recursive forecasting)
        working_series.append(forecast)
    
    return forecasts


def naive_forecast(series: List[float], horizon: int) -> List[float]:
    """
    Generate forecasts using naive method (last observed value).
    
    Args:
        series: Historical values in chronological order
        horizon: Number of periods to forecast
        
    Returns:
        List of forecasted values
    """
    if not series:
        raise ValueError("Series cannot be empty")
    
    if horizon < 1:
        raise ValueError("Horizon must be positive")
    
    last_value = max(0.0, float(series[-1]))
    return [last_value] * horizon


def normalize_weights(weights: Sequence[float]) -> Tuple[float, ...]:
    """Return weights that sum to 1. Raises if the total is not positive."""
    total = float(sum(weights))
    if total <= 0:
        raise ValueError("Weights must sum to a positive value")
    if abs(total - 1.0) <= 1e-9:
        return tuple(float(weight) for weight in weights)
    return tuple(float(weight) / total for weight in weights)


def weighted_moving_average_forecast(
    series: List[float],
    horizon: int,
    weights: Sequence[float] = DEFAULT_WMA_WEIGHTS,
) -> List[float]:
    """
    Forecast(t+1) = w1*Demand(t) + w2*Demand(t-1) + w3*Demand(t-2).

    Default weights are 0.50 / 0.30 / 0.20 (most recent first).
    Multi-step paths feed each forecast back into the window.
    """
    normalized = normalize_weights(weights)
    window = len(normalized)
    if len(series) < window:
        raise ValueError(
            f"Insufficient history: need at least {window} periods, got {len(series)}"
        )
    if horizon < 1:
        raise ValueError("Horizon must be positive")

    working = [float(value) for value in series]
    forecasts: List[float] = []
    for _ in range(horizon):
        recent = working[-window:]
        forecast = 0.0
        for index, weight in enumerate(normalized):
            forecast += weight * recent[-(index + 1)]
        forecast = max(0.0, forecast)
        forecasts.append(forecast)
        working.append(forecast)
    return forecasts


def seasonal_naive_forecast(
    series: List[float],
    horizon: int,
    season_length: int,
) -> List[float]:
    """Repeat the last complete season. Requires at least one full season."""
    if season_length < 2:
        raise ValueError("season_length must be at least 2")
    if len(series) < season_length:
        raise ValueError(
            f"Insufficient history: need at least {season_length} periods, got {len(series)}"
        )
    if horizon < 1:
        raise ValueError("Horizon must be positive")

    last_season = series[-season_length:]
    return [
        max(0.0, float(last_season[(step - 1) % season_length]))
        for step in range(1, horizon + 1)
    ]


def mean_forecast(series: List[float], horizon: int) -> List[float]:
    """Constant mean of observed values. Fallback for very short series."""
    if not series:
        raise ValueError("Series cannot be empty")
    if horizon < 1:
        raise ValueError("Horizon must be positive")
    average = max(0.0, mean(float(value) for value in series))
    return [average] * horizon


def rolling_origin_errors(
    series: List[float],
    forecast_fn: Callable[[List[float], int], List[float]],
    min_train: int,
) -> Optional[Tuple[float, float, int]]:
    """
    One-step rolling-origin evaluation.

    For each origin in [min_train, len(series)), train on series[:origin]
    and score the next actual value. Returns (mae, rmse, origin_count) or None.
    """
    if len(series) <= min_train:
        return None

    abs_errors: List[float] = []
    squared_errors: List[float] = []
    for origin in range(min_train, len(series)):
        train = series[:origin]
        try:
            predicted = forecast_fn(train, 1)[0]
        except (ValueError, IndexError):
            continue
        actual = series[origin]
        abs_errors.append(abs(actual - predicted))
        squared_errors.append((actual - predicted) ** 2)

    if len(abs_errors) < MIN_ROLLING_ORIGINS:
        return None
    return mean(abs_errors), math.sqrt(mean(squared_errors)), len(abs_errors)


def _candidate_record(
    method: str,
    label: str,
    eligible: bool,
    scores: Optional[Tuple[float, float, int]],
    note: Optional[str] = None,
) -> dict:
    return {
        "method": method,
        "label": label,
        "eligible": eligible,
        "mae": round(scores[0], 4) if scores else None,
        "rmse": round(scores[1], 4) if scores else None,
        "origins": scores[2] if scores else 0,
        "note": note,
    }


def select_forecast_method(
    series: List[float],
    horizon: int,
    window: int = 3,
    season_length: Optional[int] = None,
    weights: Sequence[float] = DEFAULT_WMA_WEIGHTS,
) -> Tuple[List[float], dict]:
    """
    Compare eligible methods on rolling-origin MAE and forecast `horizon` steps.

    Selection rules:
    - A method is eligible only if it produced at least two one-step scores.
    - The lowest MAE wins. Ties prefer WMA, then SMA, then seasonal naive, then naive.
    - If no method is eligible, fall back to SMA (3+ points), naive (1+), or mean.
    """
    values = [float(value) for value in series]
    if horizon < 1:
        raise ValueError("Horizon must be positive")
    if not values:
        raise ValueError("Series cannot be empty")

    functions: Dict[str, Callable[[List[float], int], List[float]]] = {
        "naive": naive_forecast,
        "sma": lambda data, steps: moving_average_forecast(data, window, steps),
        "wma": lambda data, steps: weighted_moving_average_forecast(data, steps, weights),
        "mean": mean_forecast,
    }
    if season_length:
        functions["seasonal_naive"] = (
            lambda data, steps, length=season_length: seasonal_naive_forecast(data, steps, length)
        )

    specs = [
        ("naive", "Naive (last observed value)", 1, 2),
        ("sma", f"{window}-period simple moving average", window, window),
        ("wma", "Weighted moving average (0.50 / 0.30 / 0.20)", len(weights), len(weights)),
    ]
    if season_length:
        specs.append(
            (
                "seasonal_naive",
                f"Seasonal naive (period {season_length})",
                season_length,
                season_length * 2,
            )
        )

    candidates: List[dict] = []
    scored: List[dict] = []
    for method, label, min_train, min_history in specs:
        fn = functions[method]
        if len(values) < min_history:
            record = _candidate_record(
                method,
                label,
                False,
                None,
                f"Needs at least {min_history} periods",
            )
            candidates.append(record)
            continue
        scores = rolling_origin_errors(values, fn, min_train)
        record = _candidate_record(
            method,
            label,
            scores is not None,
            scores,
            None if scores is not None else "Fewer than two rolling-origin scores",
        )
        candidates.append(record)
        if scores is not None:
            scored.append({**record, "fn": fn})

    fallback = False
    if scored:
        scored.sort(
            key=lambda item: (
                item["mae"],
                METHOD_TIE_PRIORITY.get(item["method"], 99),
            )
        )
        selected = scored[0]
        selected_fn = selected["fn"]
    else:
        fallback = True
        if len(values) >= window:
            method = "sma"
        elif len(values) >= 1:
            method = "naive"
        else:
            method = "mean"
        selected_fn = functions[method]
        selected = next((item for item in candidates if item["method"] == method), None)
        if selected is None:
            selected = _candidate_record(
                method,
                "Mean of observed values",
                False,
                None,
                "Fallback: insufficient history to compare methods",
            )
        selected = {
            **selected,
            "note": selected.get("note") or "Fallback: insufficient history to compare methods",
        }

    forecasts = [max(0.0, float(value)) for value in selected_fn(values, horizon)]
    naive_mae = calculate_naive_mae(values)
    selected_mae = selected.get("mae")
    mase = None
    if selected_mae is not None and naive_mae:
        mase = selected_mae / naive_mae

    naive_candidate = next((item for item in candidates if item["method"] == "naive"), None)
    naive_roll_mae = naive_candidate["mae"] if naive_candidate else None
    beats_baseline = bool(
        selected["method"] != "naive"
        and selected_mae is not None
        and naive_roll_mae is not None
        and selected_mae < naive_roll_mae
    )

    evaluation = {
        "train_periods": len(values),
        "test_periods": selected.get("origins") or 0,
        "window": window,
        "mae": round(selected_mae, 2) if selected_mae is not None else None,
        "rmse": round(selected["rmse"], 2) if selected.get("rmse") is not None else None,
        "mase": round(mase, 3) if mase is not None else None,
        "naive_mae": round(naive_mae, 2) if naive_mae else None,
        "beats_baseline": beats_baseline,
        "mase_note": None if mase is not None else "Undefined: training series is constant or too short",
        "selected_method": selected["method"],
        "selected_label": selected["label"],
        "fallback": fallback,
        "candidates": candidates,
    }
    return forecasts, evaluation


def calculate_mae(actual: List[float], predicted: List[float]) -> float:
    """Calculate Mean Absolute Error."""
    if len(actual) != len(predicted):
        raise ValueError("Actual and predicted must have same length")
    
    if not actual:
        return 0.0
    
    errors = [abs(a - p) for a, p in zip(actual, predicted)]
    return mean(errors)


def calculate_rmse(actual: List[float], predicted: List[float]) -> float:
    """Calculate Root Mean Squared Error."""
    if len(actual) != len(predicted):
        raise ValueError("Actual and predicted must have same length")
    
    if not actual:
        return 0.0
    
    squared_errors = [(a - p) ** 2 for a, p in zip(actual, predicted)]
    mse = mean(squared_errors)
    return math.sqrt(mse)


def calculate_naive_mae(series: List[float]) -> float:
    """
    Calculate MAE of naive forecast on the series itself.
    Used as scaling denominator for MASE.
    """
    if len(series) < 2:
        return 0.0
    
    naive_errors = [abs(series[i] - series[i-1]) for i in range(1, len(series))]
    return mean(naive_errors) if naive_errors else 0.0


def calculate_mase(
    actual: List[float],
    predicted: List[float],
    training_series: List[float]
) -> Optional[float]:
    """
    Calculate Mean Absolute Scaled Error.
    
    MASE = MAE_model / MAE_naive_on_training
    
    Returns None if naive MAE is zero (constant series).
    """
    mae_model = calculate_mae(actual, predicted)
    mae_naive = calculate_naive_mae(training_series)
    
    if mae_naive == 0:
        return None
    
    return mae_model / mae_naive


def chronological_split(
    series: List[float],
    train_ratio: float = 0.67
) -> Tuple[List[float], List[float]]:
    """Split series into training and test sets chronologically."""
    if not (0 < train_ratio < 1):
        raise ValueError("train_ratio must be between 0 and 1")
    
    if len(series) < 2:
        raise ValueError("Series must have at least 2 values")
    
    split_idx = int(len(series) * train_ratio)
    
    if split_idx < 1:
        split_idx = 1
    if split_idx >= len(series):
        split_idx = len(series) - 1
    
    return series[:split_idx], series[split_idx:]


def evaluate_forecast(
    series: List[float],
    train_ratio: float = 0.67,
    window: int = 3,
    season_length: Optional[int] = None,
) -> dict:
    """
    Evaluate candidate forecast methods with rolling-origin one-step errors.

    `train_ratio` is unused; it remains in the signature for callers that still
    pass the old chronological-split argument.
    """
    del train_ratio
    if len(series) < 1:
        return {
            "error": "insufficient_training_data",
            "message": "Need at least 1 period to forecast",
            "train_periods": 0,
            "test_periods": 0,
            "window": window,
            "mae": None,
            "rmse": None,
            "mase": None,
            "naive_mae": None,
            "beats_baseline": False,
            "selected_method": None,
            "selected_label": None,
            "fallback": True,
            "candidates": [],
        }

    _, evaluation = select_forecast_method(
        series,
        horizon=1,
        window=window,
        season_length=season_length,
    )
    return evaluation