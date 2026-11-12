from pydantic import PostgresDsn, model_validator
from pydantic_settings import BaseSettings

_DEV_CORS_ORIGINS = ("http://localhost:5173", "http://127.0.0.1:5173")
_DEV_ALLOWED_HOSTS = ("localhost", "127.0.0.1", "testserver")
_WEAK_SECRET_KEYS = frozenset(
    {
        "changeme",
        "change-me",
        "secret",
        "secret-key",
        "local-dev-jwt-secret-change-me",
    }
)


class Settings(BaseSettings):
    DATABASE_URL: PostgresDsn

    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    JWT_ISSUER: str = "sme-bi-platform"

    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = ""
    ALLOWED_HOSTS: str = ""
    AUTH_COOKIE_NAME: str = "sme_access_token"
    AUTH_COOKIE_SECURE: bool = False

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    @property
    def expose_docs(self) -> bool:
        return not self.is_production

    @property
    def cookie_secure(self) -> bool:
        return self.AUTH_COOKIE_SECURE or self.is_production

    @property
    def cors_origin_list(self) -> list[str]:
        origins = [item.strip() for item in self.CORS_ORIGINS.split(",") if item.strip()]
        if origins:
            return origins
        if self.is_production:
            return []
        return list(_DEV_CORS_ORIGINS)

    @property
    def allowed_host_list(self) -> list[str]:
        hosts = [item.strip() for item in self.ALLOWED_HOSTS.split(",") if item.strip()]
        if hosts:
            return hosts
        if self.is_production:
            raise ValueError("ALLOWED_HOSTS must be set when ENVIRONMENT=production")
        return list(_DEV_ALLOWED_HOSTS)

    @model_validator(mode="after")
    def reject_weak_production_secrets(self):
        if not self.is_production:
            return self
        secret = (self.SECRET_KEY or "").strip()
        if len(secret) < 32 or secret.lower() in _WEAK_SECRET_KEYS:
            raise ValueError("SECRET_KEY is not suitable for production")
        return self


settings = Settings()
