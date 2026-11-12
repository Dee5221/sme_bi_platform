import pytest

from app.core.dev_guard import assert_not_production


def test_dev_guard_allows_current_environment():
    assert_not_production("unit test")


def test_dev_guard_blocks_production(monkeypatch):
    monkeypatch.setattr("app.core.dev_guard.settings", type("S", (), {"is_production": True})())
    with pytest.raises(RuntimeError, match="disabled when ENVIRONMENT=production"):
        assert_not_production("Demonstration account seeding")
