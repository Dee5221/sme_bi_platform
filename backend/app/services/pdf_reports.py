"""
PDF rendering for SME BI reports using fpdf2.
"""
from __future__ import annotations

from datetime import datetime

from fpdf import FPDF

from app.services.report_data import REPORT_TYPES


def _text(value) -> str:
    raw = "" if value is None else str(value)
    return raw.encode("latin-1", "replace").decode("latin-1")


CURRENCY_SYMBOLS = {
    "ZMW": "K",
    "USD": "$",
    "ZAR": "R",
    "EUR": "EUR ",
    "GBP": "GBP ",
}


def format_amount(value, currency: str = "ZMW") -> str:
    if value is None:
        return "n/a"
    code = (currency or "ZMW").upper()
    prefix = CURRENCY_SYMBOLS.get(code, f"{code} ")
    return f"{prefix}{float(value):,.2f}"


def _money(business: dict):
    code = (business.get("currency") or "ZMW").upper()
    return lambda value: format_amount(value, code)


class SMEReportPDF(FPDF):
    def __init__(
        self,
        business_name: str,
        title: str,
        period_label: str,
        generated_at: str,
        subtitle: str = "",
        receipt_footer: str = "",
    ):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.business_name = _text(business_name)
        self.subtitle = _text(subtitle)
        self.receipt_footer = _text(receipt_footer)
        self.report_title = _text(title)
        self.period_label = _text(period_label)
        self.generated_at = _text(generated_at)
        self.set_margins(15, 18, 15)
        self.set_auto_page_break(auto=True, margin=20)
        self.set_title(self.report_title)
        self.set_author(self.business_name)
        self.compress = False
        self.alias_nb_pages()

    def header(self):
        self.set_font("Helvetica", "B", 13)
        self.cell(0, 6, self.business_name, new_x="LMARGIN", new_y="NEXT")
        if self.subtitle:
            self.set_font("Helvetica", "", 9)
            self.set_text_color(90)
            self.cell(0, 5, self.subtitle, new_x="LMARGIN", new_y="NEXT")
            self.set_text_color(0)
        self.set_font("Helvetica", "B", 11)
        self.cell(0, 6, self.report_title, new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)
        self.set_text_color(90)
        self.cell(0, 5, f"Reporting period: {self.period_label}", new_x="LMARGIN", new_y="NEXT")
        self.cell(0, 5, f"Generated: {self.generated_at}", new_x="LMARGIN", new_y="NEXT")
        self.set_text_color(0)
        self.ln(2)

    def footer(self):
        self.set_y(-16)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(110)
        if self.receipt_footer:
            self.cell(0, 4, self.receipt_footer, align="C", new_x="LMARGIN", new_y="NEXT")
        self.cell(
            0,
            8,
            f"Page {self.page_no()}/{{nb}}  |  Advisory report  |  Figures are not fabricated",
            align="C",
        )
        self.set_text_color(0)

    def heading(self, title: str):
        self.set_font("Helvetica", "B", 11)
        self.ln(2)
        self.cell(0, 7, _text(title), new_x="LMARGIN", new_y="NEXT")
        self.set_font("Helvetica", "", 9)

    def note(self, text: str):
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(80)
        self.multi_cell(0, 4.5, _text(text))
        self.set_text_color(0)
        self.set_font("Helvetica", "", 9)

    def empty(self, message: str):
        self.set_font("Helvetica", "I", 10)
        self.set_text_color(90)
        self.multi_cell(0, 6, _text(message))
        self.set_text_color(0)
        self.set_font("Helvetica", "", 9)

    def kpis(self, items: list[tuple[str, str]]):
        self.set_font("Helvetica", "", 9)
        for label, value in items:
            self.cell(70, 6, _text(label), border=0)
            self.set_font("Helvetica", "B", 9)
            self.cell(0, 6, _text(value), new_x="LMARGIN", new_y="NEXT")
            self.set_font("Helvetica", "", 9)
        self.ln(1)

    def add_table(self, headers: list[str], rows: list[list[str]], col_widths: list[float]):
        if not rows:
            return
        align = ["L"] * len(headers)
        for index, header in enumerate(headers):
            if header.lower() in {"total", "revenue", "amount", "cogs", "profit", "margin", "value", "units"}:
                align[index] = "R"
        self.set_font("Helvetica", "", 8)
        with self.table(
            col_widths=col_widths,
            text_align=align,
            line_height=5.5,
            markdown=False,
        ) as table:
            header_row = table.row()
            self.set_font("Helvetica", "B", 8)
            for header in headers:
                header_row.cell(_text(header))
            self.set_font("Helvetica", "", 8)
            for data in rows:
                row = table.row()
                for cell in data:
                    row.cell(_text(cell))


def _pdf(business: dict, title: str, start, end) -> SMEReportPDF:
    period = f"{start.isoformat()} to {end.isoformat()}"
    generated = datetime.now().strftime("%Y-%m-%d %H:%M")
    header_name = (business.get("report_header") or business.get("name") or "").strip()
    doc = SMEReportPDF(
        header_name,
        title,
        period,
        generated,
        subtitle=business.get("address") or "",
        receipt_footer=business.get("receipt_footer") or "",
    )
    doc.add_page()
    return doc


def _output(doc: SMEReportPDF) -> bytes:
    return bytes(doc.output())


def sales_pdf(business: dict, start, end, data: dict) -> bytes:
    money = _money(business)
    doc = _pdf(business, REPORT_TYPES["sales"], start, end)
    doc.heading("Summary")
    doc.kpis(
        [
            ("Completed sales", str(data["count"])),
            ("Total revenue", money(data["revenue"])),
            ("Average order value", money(data["aov"])),
        ]
    )
    doc.note("Only completed sales are included. Cancelled and refunded sales are excluded.")
    doc.heading("Transactions")
    if data["empty_message"]:
        doc.empty(data["empty_message"])
    else:
        if data["truncated"]:
            doc.note(f"Showing the most recent {len(data['rows'])} of {data['count']} sales.")
        doc.add_table(
            ["Sale ID", "Date", "Customer", "Payment", "Units", "Total"],
            [
                [
                    str(row["id"]),
                    row["sold_at"],
                    row["customer"],
                    row["payment"],
                    f"{row['units']:.0f}",
                    money(row["total"]),
                ]
                for row in data["rows"]
            ],
            [22, 32, 48, 28, 18, 32],
        )
    return _output(doc)


def product_performance_pdf(business: dict, start, end, data: dict) -> bytes:
    money = _money(business)
    doc = _pdf(business, REPORT_TYPES["product_performance"], start, end)
    doc.heading("Summary")
    doc.kpis(
        [
            ("Shop-open days", str(data["observed_days"])),
            ("Products with sales", str(len(data["products"]))),
        ]
    )
    doc.note(data["note"])
    doc.heading("Product ranking")
    if data["empty_message"]:
        doc.empty(data["empty_message"])
    else:
        doc.add_table(
            ["Product", "SKU", "Units", "Velocity / open day", "Revenue"],
            [
                [
                    row["product_name"],
                    row["sku"],
                    f"{row['units_sold']:.2f}",
                    f"{row['sales_velocity']:.4f}",
                    money(row["revenue"]),
                ]
                for row in data["products"]
            ],
            [55, 28, 22, 38, 37],
        )
    return _output(doc)


def inventory_pdf(business: dict, start, end, data: dict) -> bytes:
    money = _money(business)
    doc = _pdf(business, REPORT_TYPES["inventory"], start, end)
    doc.heading("Summary")
    value_label = "Inventory cost value" if data["include_costs"] else "Retail extension"
    doc.kpis(
        [
            ("Products tracked", str(data["count"])),
            ("Units on hand", f"{data['total_units']:.2f}"),
            ("Low-stock items", str(data["low_stock"])),
            (value_label, money(data["total_value"])),
        ]
    )
    doc.note(data["note"])
    doc.heading("Stock position")
    if data["empty_message"]:
        doc.empty(data["empty_message"])
    else:
        doc.add_table(
            ["Product", "SKU", "On hand", "Reorder", "Low stock", "Value"],
            [
                [
                    row["name"],
                    row["sku"],
                    f"{row['on_hand']:.2f}",
                    f"{row['reorder_level']:.2f}",
                    "Yes" if row["is_low"] else "No",
                    money(row["value"]),
                ]
                for row in data["rows"]
            ],
            [55, 28, 22, 22, 22, 31],
        )
    return _output(doc)


def expenses_pdf(business: dict, start, end, data: dict) -> bytes:
    money = _money(business)
    doc = _pdf(business, REPORT_TYPES["expenses"], start, end)
    doc.heading("Summary")
    doc.kpis(
        [
            ("Expense records", str(data["count"])),
            ("Total expenses", money(data["total"])),
        ]
    )
    if data["by_category"]:
        doc.heading("By category")
        doc.add_table(
            ["Category", "Amount"],
            [[row["category"], money(row["amount"])] for row in data["by_category"]],
            [120, 60],
        )
    doc.heading("Expense records")
    if data["empty_message"]:
        doc.empty(data["empty_message"])
    else:
        if data["truncated"]:
            doc.note(f"Showing the most recent {len(data['rows'])} of {data['count']} expenses.")
        doc.add_table(
            ["Date", "Category", "Description", "Payment", "Amount"],
            [
                [
                    row["date"],
                    row["category"],
                    row["description"],
                    row["payment"],
                    money(row["amount"]),
                ]
                for row in data["rows"]
            ],
            [24, 32, 68, 28, 28],
        )
    return _output(doc)


def gross_profit_pdf(business: dict, start, end, data: dict) -> bytes:
    money = _money(business)
    doc = _pdf(business, REPORT_TYPES["gross_profit"], start, end)
    doc.heading("Summary")
    if not data.get("available"):
        doc.empty(data.get("reason") or "Profit data unavailable.")
        doc.note("Current product cost prices are not applied to historical sales. Net profit is not calculated.")
        return _output(doc)
    doc.kpis(
        [
            ("Sale lines", str(data["line_count"])),
            ("Lines with stored unit cost", str(data["costed_line_count"])),
            ("Cost coverage", f"{data['coverage_pct']}%"),
            ("Revenue (costed lines)", money(data["revenue_costed"])),
            ("COGS", money(data["cogs"])),
            ("Gross profit", money(data["gross_profit"])),
            ("Gross margin", f"{data['gross_margin_pct']}%" if data.get("gross_margin_pct") is not None else "n/a"),
        ]
    )
    doc.note(data.get("note") or "")
    doc.heading("Product gross profit")
    if data.get("empty_message"):
        doc.empty(data["empty_message"])
    else:
        doc.add_table(
            ["Product", "Units", "Revenue", "COGS", "Gross profit", "Margin"],
            [
                [
                    row["product_name"],
                    f"{row['units_sold']:.2f}",
                    money(row["revenue"]),
                    money(row["cogs"]),
                    money(row["gross_profit"]),
                    f"{row['gross_margin_pct']}%" if row.get("gross_margin_pct") is not None else "n/a",
                ]
                for row in data["products"]
            ],
            [48, 20, 28, 28, 32, 24],
        )
    return _output(doc)


def forecast_recommendations_pdf(business: dict, start, end, forecast, recs: dict) -> bytes:
    money = _money(business)
    doc = _pdf(business, REPORT_TYPES["forecast_recommendations"], start, end)
    doc.heading("Demand and revenue forecast")
    if isinstance(forecast, dict) and forecast.get("error"):
        doc.empty(forecast["error"])
    elif forecast:
        method = forecast["methodology"]
        doc.kpis(
            [
                ("Selected method", method["label"]),
                ("History", forecast["lookback"]["label"]),
                ("Forecast months", forecast["forecastPeriod"]["label"]),
                ("Projected revenue", money(forecast["summary"]["projectedRevenueTotal"])),
                ("Projected expenses", money(forecast["summary"]["projectedExpensesTotal"])),
            ]
        )
        doc.note(method["description"])
        eval_metrics = forecast.get("evaluation") or {}
        doc.heading("Forecast error")
        doc.kpis(
            [
                ("MAE", str(eval_metrics.get("mae") if eval_metrics.get("mae") is not None else "n/a")),
                ("RMSE", str(eval_metrics.get("rmse") if eval_metrics.get("rmse") is not None else "n/a")),
                ("MASE", str(eval_metrics.get("mase") if eval_metrics.get("mase") is not None else "n/a")),
            ]
        )
        urgent = [item for item in forecast.get("inventoryForecasts") or [] if item.get("urgency") == "HIGH"][:15]
        doc.heading("High stockout risk")
        if not urgent:
            doc.empty("No high-urgency stockout risks on the current demand path.")
        else:
            doc.add_table(
                ["Product", "On hand", "Daily demand", "Days of cover", "Cover estimate"],
                [
                    [
                        item["productName"],
                        str(item["currentQuantity"]),
                        str(item.get("forecastDailyDemand") or "n/a"),
                        str(item["estimatedDaysUntilStockout"] if item["estimatedDaysUntilStockout"] is not None else "n/a"),
                        str(item["suggestedRestockQuantity"]),
                    ]
                    for item in urgent
                ],
                [55, 25, 30, 35, 35],
            )
            doc.note("Cover estimates are not reliable reorder points; supplier lead time is not recorded.")
    doc.heading("Recommendations")
    items = (recs or {}).get("recommendations") or []
    if not items:
        doc.empty("No advisory recommendations for this business in the current ruleset.")
    else:
        doc.note("Recommendations are advisory and do not change stock quantities or product prices.")
        for item in items[:25]:
            doc.set_font("Helvetica", "B", 9)
            doc.multi_cell(0, 5, _text(f"{item['severity']}: {item['title']}"))
            doc.set_font("Helvetica", "", 8)
            doc.multi_cell(0, 4.5, _text(item.get("explanation") or ""))
            doc.set_font("Helvetica", "I", 8)
            doc.multi_cell(0, 4.5, _text(f"Action: {item.get('suggested_action')}"))
            if item.get("period"):
                doc.multi_cell(0, 4.5, _text(f"Period: {item['period']}"))
            doc.ln(1)
        if len(items) > 25:
            doc.note(f"Showing 25 of {len(items)} recommendations.")
    return _output(doc)


def business_summary_pdf(
    business: dict,
    start,
    end,
    sales: dict,
    expenses: dict,
    inventory: dict,
    profit: dict,
) -> bytes:
    money = _money(business)
    doc = _pdf(business, REPORT_TYPES["business_summary"], start, end)
    doc.heading("Sales")
    doc.kpis(
        [
            ("Completed sales", str(sales["count"])),
            ("Revenue", money(sales["revenue"])),
            ("Average order value", money(sales["aov"])),
        ]
    )
    doc.heading("Expenses and cash")
    net_cash = round(sales["revenue"] - expenses["total"], 2)
    doc.kpis(
        [
            ("Expenses", money(expenses["total"])),
            ("Net cash flow", money(net_cash)),
        ]
    )
    doc.note("Net cash flow is revenue minus recorded expenses. It excludes COGS and is not net profit.")
    doc.heading("Inventory")
    doc.kpis(
        [
            ("Products", str(inventory["count"])),
            ("Low stock", str(inventory["low_stock"])),
            ("On-hand units", f"{inventory['total_units']:.2f}"),
        ]
    )
    doc.note(inventory["note"])
    doc.heading("Gross profit")
    if not profit.get("available"):
        doc.empty(profit.get("reason") or "Profit data unavailable.")
    else:
        doc.kpis(
            [
                ("Gross profit", money(profit["gross_profit"])),
                ("Gross margin", f"{profit['gross_margin_pct']}%" if profit.get("gross_margin_pct") is not None else "n/a"),
                ("Cost coverage", f"{profit['coverage_pct']}% of sale lines"),
            ]
        )
        doc.note(profit.get("note") or "")
    return _output(doc)
