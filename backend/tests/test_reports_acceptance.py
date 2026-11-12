from datetime import date, timedelta

from tests.helpers import OWNER, STAFF, client, login


def test_empty_period_sales_report_is_still_a_pdf():
    api = client()
    headers = login(api, OWNER)
    start = (date.today() + timedelta(days=365)).isoformat()
    end = (date.today() + timedelta(days=370)).isoformat()
    response = api.get(f"/api/reports/sales?start_date={start}&end_date={end}", headers=headers)
    assert response.status_code == 200, response.text
    assert response.content[:4] == b"%PDF"
    assert "attachment" in response.headers.get("content-disposition", "")


def test_sales_report_includes_business_identity():
    api = client()
    headers = login(api, OWNER)
    start = (date.today() - timedelta(days=30)).isoformat()
    end = date.today().isoformat()
    response = api.get(f"/api/reports/sales?start_date={start}&end_date={end}", headers=headers)
    assert response.status_code == 200, response.text
    lowered = response.content.lower()
    assert b"%pdf" == response.content[:4].lower()
    assert b"lusaka" in lowered or b"wholesale" in lowered


def test_staff_cannot_download_any_report_type():
    api = client()
    headers = login(api, STAFF)
    start = date.today().replace(day=1).isoformat()
    end = date.today().isoformat()
    for report_type in ("sales", "inventory", "expenses", "gross_profit", "business_summary"):
        response = api.get(
            f"/api/reports/{report_type}?start_date={start}&end_date={end}",
            headers=headers,
        )
        assert response.status_code == 403, report_type
