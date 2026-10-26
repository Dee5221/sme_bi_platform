from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# ==============================================================================
# IMPORT ONLY MODULES THAT ACTUALLY EXIST IN backend/app/api/v1/
# ==============================================================================
from app.api.v1 import (
    auth,
    users,
    categories,
    products,
    customers,
    suppliers,
    inventory,
    sales,
    expenses,
    analytics,
    forecasting,
)

app = FastAPI(title="SME BI Platform API", version="0.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex="http://localhost:.*",
)

# ==============================================================================
# REGISTER ROUTERS
# ==============================================================================
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(customers.router)
app.include_router(suppliers.router)
app.include_router(inventory.router)
app.include_router(sales.router)
app.include_router(expenses.router)
app.include_router(analytics.router)
app.include_router(forecasting.router)
# ==============================================================================
# HEALTH CHECK
# ==============================================================================
@app.get("/")
def read_root():
    return {
        "message": "SME BI Platform API is running. Analytics module active.",
        "status": "healthy"
    }