"""
Product performance, historical-cost profitability, and daily demand forecasts.

Profit uses snapshotted sale_items.unit_cost only. Current product cost_price
is never applied to historical sales. Days with no completed business sales
are not treated as zero-demand days.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from statistics import median
from typing import Iterable, Optional

from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.models.inventory import Inventory
from app.models.product import Product
from app.models.sale import Sale, SaleItem
from app.services.forecasting import select_forecast_method

COMPLETED_STATUS = "completed"
PROFIT_UNAVAILABLE_REASON = (
    "Profit data unavailable. Sale items created before cost snapshotting do not "
    "store historical unit cost. Current product cost prices are not applied to "
    "past sales, and net profit is not calculated without reliable COGS."
)
OPEN_DAYS_NOTE = (
    "Sales velocity uses business-open days (dates with at least one completed "
    "sale). Days with no shop sales are not treated as zero demand."
)
REORDER_NOTE = (
    "Supplier lead time is not recorded. Suggested quantity is a cover estimate "
    "for the forecast horizon plus the product reorder level as safety stock, "
    "not a reliable reorder point."
)
NO_INCOMING_NOTE = (
    "Confirmed incoming purchase orders are not recorded, so inventory position "
    "is on-hand stock only."
)


def _as_float(value) -> float:
    return float(value or 0)


def _date_bounds(start: date, end: date) -> tuple[datetime, datetime]:
    start_inclusive = datetime.combine(start, datetime.min.time())
    end_exclusive = datetime.combine(end + timedelta(days=1), datetime.min.time())
    return start_inclusive, end_exclusive


def resolve_period(
    start_date: Optional[date],
    end_date: Optional[date],
    period: Optional[int],
) -> tuple[date, date]:
    today = date.today()
    if period in (7, 30, 90):
        return today - timedelta(days=period - 1), today
    if start_date and end_date:
        return start_date, end_date
    if start_date:
        return start_date, today
    if end_date:
        return end_date.replace(day=1), end_date
    return today.replace(day=1), today


def business_open_dates(
    db: Session,
    business_id: int,
    start: date,
    end: date,
) -> list[date]:
    start_inclusive, end_exclusive = _date_bounds(start, end)
    rows = (
        db.query(func.date(Sale.sale_datetime).label("sale_day"))
        .filter(
            Sale.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= start_inclusive,
            Sale.sale_datetime < end_exclusive,
        )
        .distinct()
        .order_by(func.date(Sale.sale_datetime))
        .all()
    )
    open_dates: list[date] = []
    for row in rows:
        day = row.sale_day
        if isinstance(day, datetime):
            day = day.date()
        elif isinstance(day, str):
            day = date.fromisoformat(day)
        open_dates.append(day)
    return open_dates


def _product_label(name, sku, fallback_name=None, fallback_sku=None) -> tuple[str, str]:
    display_name = name or fallback_name or "Unknown product"
    display_sku = sku or fallback_sku or ""
    return display_name, display_sku


def product_performance(
    db: Session,
    business_id: int,
    start: date,
    end: date,
    limit: int = 20,
) -> dict:
    start_inclusive, end_exclusive = _date_bounds(start, end)
    open_dates = business_open_dates(db, business_id, start, end)
    observed_days = len(open_dates)

    rows = (
        db.query(
            SaleItem.product_id.label("product_id"),
            func.coalesce(func.max(SaleItem.product_name), func.max(Product.name)).label("product_name"),
            func.coalesce(func.max(SaleItem.sku), func.max(Product.sku)).label("sku"),
            func.coalesce(func.sum(SaleItem.quantity), 0).label("units_sold"),
            func.coalesce(func.sum(SaleItem.subtotal), 0).label("revenue"),
        )
        .select_from(SaleItem)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
        .filter(
            Sale.business_id == business_id,
            Product.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= start_inclusive,
            Sale.sale_datetime < end_exclusive,
        )
        .group_by(SaleItem.product_id)
        .all()
    )

    products = []
    for row in rows:
        units = _as_float(row.units_sold)
        revenue = round(_as_float(row.revenue), 2)
        velocity = round(units / observed_days, 4) if observed_days else 0.0
        name, sku = _product_label(row.product_name, row.sku)
        products.append(
            {
                "product_id": row.product_id,
                "product_name": name,
                "sku": sku,
                "units_sold": units,
                "revenue": revenue,
                "observed_days": observed_days,
                "sales_velocity": velocity,
            }
        )

    by_units = sorted(products, key=lambda item: item["units_sold"], reverse=True)
    by_velocity = sorted(products, key=lambda item: item["sales_velocity"], reverse=True)
    by_revenue = sorted(products, key=lambda item: item["revenue"], reverse=True)
    rank_units = {item["product_id"]: index + 1 for index, item in enumerate(by_units)}
    rank_velocity = {item["product_id"]: index + 1 for index, item in enumerate(by_velocity)}
    rank_revenue = {item["product_id"]: index + 1 for index, item in enumerate(by_revenue)}

    ranked = []
    for item in by_revenue:
        ranked.append(
            {
                **item,
                "rank_units": rank_units[item["product_id"]],
                "rank_velocity": rank_velocity[item["product_id"]],
                "rank_revenue": rank_revenue[item["product_id"]],
            }
        )

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "observed_days": observed_days,
        "note": OPEN_DAYS_NOTE,
        "products": ranked[:limit],
        "top_by_units": by_units[:limit],
        "top_by_velocity": by_velocity[:limit],
        "top_by_revenue": by_revenue[:limit],
    }


def _classify_products(products: list[dict]) -> None:
    if not products:
        return
    units = [item["units_sold"] for item in products]
    volume_cut = median(units)
    for item in products:
        margin = item["gross_margin_pct"]
        volume = item["units_sold"]
        if item["gross_profit"] < 0:
            item["classification"] = "negative_margin"
        elif volume >= volume_cut and margin is not None and margin < 20:
            item["classification"] = "high_volume_low_margin"
        elif volume <= volume_cut and margin is not None and margin >= 40:
            item["classification"] = "low_volume_high_margin"
        else:
            item["classification"] = "typical"


def profitability(
    db: Session,
    business_id: int,
    start: date,
    end: date,
    limit: int = 20,
) -> dict:
    start_inclusive, end_exclusive = _date_bounds(start, end)

    totals = (
        db.query(
            func.count(SaleItem.id).label("line_count"),
            func.coalesce(func.sum(costed_line_flag()), 0).label("costed_line_count"),
            func.coalesce(func.sum(SaleItem.subtotal), 0).label("revenue_all"),
            func.coalesce(func.sum(costed_revenue_expr()), 0).label("revenue_costed"),
            func.coalesce(func.sum(costed_cogs_expr()), 0).label("cogs"),
        )
        .select_from(SaleItem)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(
            Sale.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= start_inclusive,
            Sale.sale_datetime < end_exclusive,
        )
        .first()
    )

    line_count = int(totals.line_count or 0)
    costed_line_count = int(totals.costed_line_count or 0)
    revenue_all = round(_as_float(totals.revenue_all), 2)
    revenue_costed = round(_as_float(totals.revenue_costed), 2)
    cogs = round(_as_float(totals.cogs), 2)
    coverage_pct = round(100.0 * costed_line_count / line_count, 1) if line_count else 0.0

    base = {
        "available": costed_line_count > 0,
        "reason": None if costed_line_count > 0 else PROFIT_UNAVAILABLE_REASON,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "line_count": line_count,
        "costed_line_count": costed_line_count,
        "coverage_pct": coverage_pct,
        "revenue_all": revenue_all,
        "revenue_costed": revenue_costed,
        "cogs": cogs,
        "gross_profit": round(revenue_costed - cogs, 2) if costed_line_count else None,
        "gross_margin_pct": (
            round(100.0 * (revenue_costed - cogs) / revenue_costed, 2)
            if costed_line_count and revenue_costed
            else None
        ),
        "products": [],
        "top_by_gross_profit": [],
        "top_by_margin": [],
        "high_volume_low_margin": [],
        "low_volume_high_margin": [],
        "negative_margin": [],
        "note": (
            "Gross profit uses snapshotted sale-item unit cost only. Current product "
            "cost prices are not applied to historical sales. Net profit is not "
            "calculated because operating expenses are not allocated to products."
        ),
    }
    if costed_line_count == 0:
        return base

    rows = (
        db.query(
            SaleItem.product_id.label("product_id"),
            func.coalesce(func.max(SaleItem.product_name), func.max(Product.name)).label("product_name"),
            func.coalesce(func.max(SaleItem.sku), func.max(Product.sku)).label("sku"),
            func.coalesce(func.sum(SaleItem.quantity), 0).label("units_sold"),
            func.coalesce(func.sum(SaleItem.subtotal), 0).label("revenue"),
            func.coalesce(func.sum(SaleItem.unit_cost * SaleItem.quantity), 0).label("cogs"),
        )
        .select_from(SaleItem)
        .join(Sale, SaleItem.sale_id == Sale.id)
        .join(Product, SaleItem.product_id == Product.id)
        .filter(
            Sale.business_id == business_id,
            Product.business_id == business_id,
            Sale.status == COMPLETED_STATUS,
            Sale.sale_datetime >= start_inclusive,
            Sale.sale_datetime < end_exclusive,
            SaleItem.unit_cost.isnot(None),
        )
        .group_by(SaleItem.product_id)
        .all()
    )

    products = []
    for row in rows:
        revenue = round(_as_float(row.revenue), 2)
        product_cogs = round(_as_float(row.cogs), 2)
        gross_profit = round(revenue - product_cogs, 2)
        margin = round(100.0 * gross_profit / revenue, 2) if revenue else None
        name, sku = _product_label(row.product_name, row.sku)
        products.append(
            {
                "product_id": row.product_id,
                "product_name": name,
                "sku": sku,
                "units_sold": _as_float(row.units_sold),
                "revenue": revenue,
                "cogs": product_cogs,
                "gross_profit": gross_profit,
                "gross_margin_pct": margin,
                "classification": "typical",
            }
        )

    _classify_products(products)
    by_profit = sorted(products, key=lambda item: item["gross_profit"], reverse=True)
    by_margin = sorted(
        [item for item in products if item["gross_margin_pct"] is not None],
        key=lambda item: item["gross_margin_pct"],
        reverse=True,
    )
    base.update(
        {
            "products": by_profit[:limit],
            "top_by_gross_profit": by_profit[:limit],
            "top_by_margin": by_margin[:limit],
            "high_volume_low_margin": [
                item for item in products if item["classification"] == "high_volume_low_margin"
            ][:limit],
            "low_volume_high_margin": [
                item for item in products if item["classification"] == "low_volume_high_margin"
            ][:limit],
            "negative_margin": [
                item for item in products if item["classification"] == "negative_margin"
            ][:limit],
        }
    )
    return base


def costed_line_flag():
    return case((SaleItem.unit_cost.isnot(None), 1), else_=0)


def costed_revenue_expr():
    return case((SaleItem.unit_cost.isnot(None), SaleItem.subtotal), else_=0)


def costed_cogs_expr():
    return case(
        (SaleItem.unit_cost.isnot(None), SaleItem.unit_cost * SaleItem.quantity),
        else_=0,
    )


def _urgency(days_until_stockout: Optional[int], on_hand: float, reorder_level: float, daily_demand: float) -> str:
    if daily_demand <= 0:
        return "NONE"
    if on_hand <= 0 or (days_until_stockout is not None and days_until_stockout <= 7):
        return "HIGH"
    if on_hand <= reorder_level:
        return "HIGH"
    if days_until_stockout is not None and days_until_stockout <= 14:
        return "MEDIUM"
    return "LOW"


def inventory_demand_forecasts(
    db: Session,
    business_id: int,
    demand_horizon: int = 7,
) -> list[dict]:
    """
    Daily demand path per product on shop-open days.

    Lookback is max(30, 4 * horizon) calendar days. Missing shop-open days
    for a product are zero (the shop sold other items that day). Calendar
    days with no completed sales are omitted.
    """
    lookback_days = max(30, demand_horizon * 4)
    end = date.today()
    start = end - timedelta(days=lookback_days - 1)
    start_inclusive, end_exclusive = _date_bounds(start, end)
    open_dates = business_open_dates(db, business_id, start, end)
    open_index = {day: index for index, day in enumerate(open_dates)}

    inventory_rows = (
        db.query(
            Inventory.product_id,
            Inventory.quantity_on_hand,
            Product.name,
            Product.sku,
            Product.reorder_level,
            Product.selling_price,
        )
        .join(Product, Inventory.product_id == Product.id)
        .filter(Product.business_id == business_id)
        .all()
    )

    qty_rows = []
    if open_dates:
        qty_rows = (
            db.query(
                SaleItem.product_id.label("product_id"),
                func.date(Sale.sale_datetime).label("sale_day"),
                func.coalesce(func.sum(SaleItem.quantity), 0).label("qty"),
            )
            .select_from(SaleItem)
            .join(Sale, SaleItem.sale_id == Sale.id)
            .join(Product, SaleItem.product_id == Product.id)
            .filter(
                Sale.business_id == business_id,
                Product.business_id == business_id,
                Sale.status == COMPLETED_STATUS,
                Sale.sale_datetime >= start_inclusive,
                Sale.sale_datetime < end_exclusive,
            )
            .group_by(SaleItem.product_id, func.date(Sale.sale_datetime))
            .all()
        )

    qty_by_product: dict[int, list[float]] = defaultdict(lambda: [0.0] * len(open_dates))
    for row in qty_rows:
        day = row.sale_day
        if isinstance(day, datetime):
            day = day.date()
        elif isinstance(day, str):
            day = date.fromisoformat(day)
        index = open_index.get(day)
        if index is None:
            continue
        qty_by_product[row.product_id][index] = _as_float(row.qty)

    forecasts = []
    for inv in inventory_rows:
        series = qty_by_product.get(inv.product_id, [0.0] * len(open_dates))
        on_hand = _as_float(inv.quantity_on_hand)
        reorder_level = _as_float(inv.reorder_level)
        selling_price = _as_float(inv.selling_price)
        open_days_used = len(open_dates)
        data_sufficient = open_days_used >= 3 and any(value > 0 for value in series)

        if open_days_used == 0 or not any(value > 0 for value in series):
            daily_path = [0.0] * demand_horizon
            evaluation = {
                "selected_method": "none",
                "selected_label": "No observed demand on shop-open days",
                "fallback": True,
                "mae": None,
                "rmse": None,
                "mase": None,
            }
        else:
            daily_path, evaluation = select_forecast_method(
                series,
                horizon=demand_horizon,
                window=min(3, len(series)),
                season_length=7 if len(series) >= 14 else None,
            )
            daily_path = [max(0.0, float(value)) for value in daily_path]

        horizon_demand = round(sum(daily_path), 2)
        daily_demand = round(horizon_demand / demand_horizon, 4) if demand_horizon else 0.0
        if daily_demand > 0:
            days_until_stockout = int(on_hand / daily_demand)
        else:
            days_until_stockout = None

        suggested = max(0, int(round(horizon_demand + reorder_level - on_hand)))
        avg_monthly = round(sum(series) / max(len(series), 1) * 30, 2) if series else 0.0
        projected_month = round(daily_demand * 30, 2)
        expected_revenue = round(horizon_demand * selling_price, 2) if selling_price else None

        forecasts.append(
            {
                "productId": inv.product_id,
                "productName": inv.name,
                "productSku": inv.sku or "",
                "currentQuantity": on_hand,
                "lowStockThreshold": reorder_level,
                "averageMonthlyDemand": avg_monthly,
                "projectedDemandNextMonth": projected_month,
                "estimatedDaysUntilStockout": days_until_stockout,
                "suggestedRestockQuantity": suggested,
                "urgency": _urgency(days_until_stockout, on_hand, reorder_level, daily_demand),
                "forecastDailyDemand": daily_demand,
                "horizonDemand": horizon_demand,
                "demandHorizonDays": demand_horizon,
                "selectedMethod": evaluation.get("selected_method"),
                "selectedMethodLabel": evaluation.get("selected_label"),
                "reorderReliable": False,
                "reorderNote": f"{REORDER_NOTE} {NO_INCOMING_NOTE}",
                "safetyStock": reorder_level,
                "forecastPath": [round(value, 4) for value in daily_path],
                "openDaysUsed": open_days_used,
                "dataSufficient": data_sufficient,
                "evaluationMae": evaluation.get("mae"),
                "expectedRevenue": expected_revenue,
                "fallback": bool(evaluation.get("fallback")),
            }
        )

    urgency_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2, "NONE": 3}
    forecasts.sort(
        key=lambda item: (
            urgency_order.get(item["urgency"], 9),
            item["estimatedDaysUntilStockout"]
            if item["estimatedDaysUntilStockout"] is not None
            else 10**9,
            -item["horizonDemand"],
        )
    )
    return forecasts


def stockout_notes(forecasts: Iterable[dict], demand_horizon: int) -> list[dict]:
    notes = []
    for item in forecasts:
        if item["urgency"] == "HIGH":
            days = item["estimatedDaysUntilStockout"]
            notes.append(
                {
                    "productName": item["productName"],
                    "period": f"next {demand_horizon} days",
                    "metric": f"{item['forecastDailyDemand']} units/day forecast",
                    "reason": (
                        f"{item['productName']} may run out "
                        + (f"in about {days} days" if days is not None else "during the forecast period")
                        + f" with {item['currentQuantity']} on hand."
                    ),
                    "suggestedAction": "Check stock and restock this product.",
                    "dataSufficient": item["dataSufficient"],
                }
            )
        if len(notes) >= 8:
            break
    if not any(item.get("reorderReliable") for item in forecasts):
        notes.append(
            {
                "productName": None,
                "period": f"next {demand_horizon} days",
                "metric": "lead time missing",
                "reason": REORDER_NOTE,
                "suggestedAction": "Review restock quantities before placing orders.",
                "dataSufficient": False,
            }
        )
    return notes
