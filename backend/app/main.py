import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import http_exception_handler, request_validation_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.requests import Request

from app.api.v1 import (
    analytics,
    audit,
    auth,
    business,
    categories,
    customers,
    expenses,
    forecasting,
    inventory,
    products,
    profile,
    recommendations,
    reports,
    roles,
    sales,
    suppliers,
    users,
)
from app.core.config import settings
from app.core.middleware import SecurityHeadersMiddleware

logger = logging.getLogger("sme_bi")

app = FastAPI(
    title="SME BI Platform API",
    version="0.5.0",
    docs_url="/docs" if settings.expose_docs else None,
    redoc_url="/redoc" if settings.expose_docs else None,
    openapi_url="/openapi.json" if settings.expose_docs else None,
)

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.allowed_host_list)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Idempotency-Key"],
)

app.include_router(auth.router)
app.include_router(profile.router)
app.include_router(users.router)
app.include_router(roles.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(customers.router)
app.include_router(suppliers.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(expenses.router)
app.include_router(analytics.router)
app.include_router(forecasting.router)
app.include_router(recommendations.router)
app.include_router(reports.router)
app.include_router(audit.router)
app.include_router(business.router)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    if isinstance(exc, StarletteHTTPException):
        return await http_exception_handler(request, exc)
    if isinstance(exc, RequestValidationError):
        return await request_validation_exception_handler(request, exc)
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    if settings.expose_docs:
        raise exc
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred"},
    )


@app.get("/")
def read_root():
    return {
        "message": "SME BI Platform API is running. Analytics module active.",
        "status": "healthy",
    }
