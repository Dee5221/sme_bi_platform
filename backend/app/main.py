from fastapi import FastAPI
from app.api.v1 import auth, users, categories, products, customers, suppliers, inventory

app = FastAPI(title="SME BI Platform API", version="0.4.0")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(customers.router)
app.include_router(suppliers.router)
app.include_router(inventory.router)

@app.get("/")
def read_root():
    return {"message": "SME BI Platform API is running. Inventory module implemented."}