from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FRONTEND = ROOT / "frontend" / "src"


def _read(relative: str) -> str:
    return (FRONTEND / relative).read_text(encoding="utf-8")


def test_skip_link_and_main_landmark_exist():
    shell = _read("components/layout/AppShell.tsx")
    css = _read("components/layout/AppShell.css")
    assert 'href="#main-content"' in shell
    assert "Skip to main content" in shell
    assert "skip-link" in css
    assert "Open navigation menu" in shell


def test_dialog_lock_prevents_background_scroll():
    source = _read("components/ui/dialogLock.ts")
    assert "overflow = 'hidden'" in source
    assert "position = 'fixed'" in source
    assert "dataset.dialogOpen" in source


def test_alerts_use_correct_live_roles():
    source = _read("components/ui/Alert.tsx")
    assert "role={urgent ? 'alert' : 'status'}" in source
    assert "aria-live={urgent ? 'assertive' : 'polite'}" in source


def test_visible_focus_and_theme_tokens_are_present():
    index_css = _read("index.css")
    button_css = _read("components/ui/Button.css")
    assert ":focus-visible" in index_css
    assert ":focus-visible" in button_css
    assert "--accent-primary" in index_css
    assert "--bg-sidebar" in index_css


def test_login_page_has_no_demo_or_debug_shortcuts():
    source = _read("pages/LoginPage.tsx").lower()
    assert "ownerpass" not in source
    assert "staffpass" not in source
    assert "demo login" not in source
    assert "fill demo" not in source
    assert "debug" not in source


def test_pages_have_no_evaluator_advisory_banners():
    pages = FRONTEND / "pages"
    banned = (
        "advisory notice",
        "analysis limitations",
        "heuristic and explainable",
        "gross profit uses snapshotted",
        "supplier lead time is not recorded",
        "net profit is not calculated",
        "excludes cogs",
        "reserved for future enhancement",
    )
    hits: list[str] = []
    for path in pages.glob("*.tsx"):
        source = path.read_text(encoding="utf-8").lower()
        for phrase in banned:
            if phrase in source:
                hits.append(f"{path.name}: {phrase}")
    assert hits == []
