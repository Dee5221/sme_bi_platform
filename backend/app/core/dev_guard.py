"""Block demonstration utilities outside local development."""
from app.core.config import settings


def assert_not_production(action: str = "This operation") -> None:
    if settings.is_production:
        raise RuntimeError(
            f"{action} is disabled when ENVIRONMENT=production. "
            "Provision a real owner account instead of using demonstration data."
        )
