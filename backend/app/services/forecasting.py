"""
Pure-Python forecasting service for SME BI Platform.
Implements moving average and naive forecasting with proper evaluation.
"""
import math
from typing import List, Tuple, Optional
from statistics import mean


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
        forecast = sum(recent) / window
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
    
    last_value = series[-1]
    return [last_value] * horizon


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
    window: int = 3
) -> dict:
    """
    Evaluate moving average forecast using chronological split.
    
    Returns dictionary with evaluation metrics.
    """
    train, test = chronological_split(series, train_ratio)
    
    if len(train) < window:
        return {
            "error": "insufficient_training_data",
            "message": f"Need at least {window} training periods, got {len(train)}",
            "train_periods": len(train),
            "test_periods": len(test),
            "window": window,
            "mae": None,
            "rmse": None,
            "mase": None,
            "naive_mae": None,
            "beats_baseline": False,
        }
    
    # Generate forecasts for test period
    forecasted = moving_average_forecast(train.copy(), window, len(test))
    
    # Calculate metrics
    mae = calculate_mae(test, forecasted)
    rmse = calculate_rmse(test, forecasted)
    mase = calculate_mase(test, forecasted, train)
    
    # Naive baseline for comparison
    naive_forecasted = naive_forecast(train, len(test))
    naive_mae = calculate_mae(test, naive_forecasted)
    
    return {
        "train_periods": len(train),
        "test_periods": len(test),
        "window": window,
        "mae": round(mae, 2),
        "rmse": round(rmse, 2),
        "mase": round(mase, 3) if mase is not None else None,
        "naive_mae": round(naive_mae, 2),
        "beats_baseline": mae < naive_mae,
        "mase_note": None if mase is not None else "Undefined: training series is constant",
    }