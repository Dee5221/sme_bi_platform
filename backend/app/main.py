from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, users, categories, products, customers, suppliers, inventory, sales

app = FastAPI(title="SME BI Platform API", version="0.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://127.0.0.1:5173", # Vite alternative
        "http://localhost:3000", # Common React port
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"], # Allows GET, POST, PUT, DELETE, OPTIONS, etc.
    allow_headers=["*"], # Allows Authorization, Content-Type, etc.
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(categories.router)
app.include_router(products.router)
app.include_router(customers.router)
app.include_router(suppliers.router)
app.include_router(inventory.router)
app.include_router(sales.router)  

@app.get("/")
def read_root():
    return {"message": "SME BI Platform API is running. Sales module implemented."}