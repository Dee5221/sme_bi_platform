# Intelligent Business Intelligence & Decision-Support Platform for SMEs

An intelligent, web-based **Business Intelligence (BI) and Decision-Support Platform** designed to help Small and Medium-Sized Retail Enterprises (SMEs) transform operational data into meaningful insights for better business decision-making.

The platform integrates **retail operations, business intelligence, predictive analytics, and decision support** into a single system.

Role-by-role access, repository layout, and the permission matrix are in [`PROJECT_STRUCTURE.md`](PROJECT_STRUCTURE.md).

---

## 📌 Project Overview

Small and medium-sized retail businesses generate large amounts of operational data from activities such as sales, inventory management, products, customers, suppliers, and expenses.

Although computerized retail management systems can capture and store this information, business owners and managers may still lack integrated tools for:

* Understanding business performance
* Monitoring important KPIs
* Identifying sales and inventory trends
* Detecting low-stock products
* Predicting future demand
* Receiving actionable business insights

This project addresses that gap by developing an analytical and decision-support layer on top of retail operational data.

### Core Concept

```text
Retail Operational Data
          ↓
Data Integration & Management
          ↓
Business Intelligence
          ↓
Predictive Analytics
          ↓
Decision Support
          ↓
Data-Driven Business Decisions
```

---

## 🎯 Project Objectives

The platform aims to:

1. Identify the functional and analytical requirements of an SME retail environment.
2. Integrate important retail operational data into a centralized platform.
3. Provide BI dashboards, KPIs and reports for monitoring business performance.
4. Apply predictive analytics to estimate future sales/product demand.
5. Provide alerts, insights and recommendations to support business decisions.
6. Evaluate the functionality, usability and effectiveness of the developed platform.

---

## ✅ Implementation Status

All core modules have been implemented and integrated.

### Core Operations (F01–F08)

* [x] PostgreSQL database foundation
* [x] Authentication and authorization (JWT + Argon2id)
* [x] User roles and permissions (Business Owner, Manager, Staff)
* [x] Business provisioning and multi-tenant isolation
* [x] Product management
* [x] Category management
* [x] Inventory management with stock movements
* [x] Sales and transaction management
* [x] Customer management
* [x] Supplier management
* [x] Expense management

### Business Intelligence (F09)

* [x] Centralized backend aggregation engine
* [x] Executive dashboard with KPI cards
* [x] Total Revenue, Total Expenses, Net Cash Flow (proxy)
* [x] Transaction count and Average Order Value (AOV)
* [x] Low-stock alerts
* [x] Sales trend analysis (daily/monthly)
* [x] Revenue by category breakdown
* [x] Inventory health metrics

### Predictive Analytics (F10)

* [x] Pure-Python forecasting service (SMA, WMA, naive, seasonal naive)
* [x] Naive baseline forecasting for comparison
* [x] Chronological train/test split evaluation
* [x] MAE, RMSE, and MASE evaluation metrics
* [x] Revenue and expense forecasting
* [x] Inventory demand forecasting with stockout risk estimation
* [x] Urgency classification (CRITICAL / HIGH / MEDIUM / LOW)
* [x] Data quality indicators and limitations

### Decision Support & Recommendations (F11)

* [x] Rule-based recommendation engine (7 rules)
* [x] Low Stock Alert
* [x] Stockout Risk
* [x] No Recent Sales
* [x] Revenue Decline
* [x] Revenue Concentration
* [x] Expense Increase
* [x] Expense Category Concentration
* [x] Severity-based filtering (CRITICAL / HIGH / MEDIUM / LOW / INFO)
* [x] Category-based filtering (Inventory / Sales / Expenses)
* [x] Analysis period selection (3 / 6 / 9 / 12 months)
* [x] Data quality and limitations display
* [x] Dashboard integration with recommendations summary card
* [x] Role-based recommendation access (Owner and Manager only; Staff have no BI screens)

### Administration, reports, and production readiness

* [x] Itemised sales history with snapshotted name, SKU, price, and unit cost
* [x] Weighted moving average and rolling-origin forecast evaluation
* [x] Gross profit from snapshotted sale costs only
* [x] Tenant-scoped PDF reports
* [x] Owner user administration, locked roles matrix, activity log, business settings
* [x] Dialog scroll lock, skip link, and visible focus
* [x] JWT expiry/revocation, login rate limiting, security headers, environment-based CORS
* [x] Automated pytest acceptance suite
* [x] Self-service profile and password change (`/api/profile`)

### Deferred / Future Work

* [ ] Profile photo storage
* [ ] Recommendation persistence and dismissal
* [ ] Configurable alert thresholds
* [ ] CSV/Excel report export
* [ ] Shared-rate-limit / token-revocation store for multi-process production
* [ ] Formal usability evaluation with shop staff

---

## 👥 User Roles

The platform supports role-based access control.

| Role               | Description                                                                      |
| ------------------ | -------------------------------------------------------------------------------- |
| **Business Owner** | Full operations, BI, forecasts, PDF reports, users, audit, and settings          |
| **Manager**        | Day-to-day operations, expenses, analytics, forecasts, and reports. No user admin |
| **Staff**          | Point of sale, own sales history, product and customer lookup                    |

Authorization is enforced on the **backend**, not only through the user interface.

---

## 🏗️ System Architecture

The platform follows a layered architecture designed to separate business operations from analytics and decision support.

```text
┌───────────────────────────────┐
│          Web Frontend         │
│  React 18 • TypeScript • Vite │
│  Dashboard • Forms • Reports  │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│          Backend API          │
│  FastAPI • JWT • RBAC         │
│  Auth • Business Logic        │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│        PostgreSQL DB          │
│  SQLAlchemy 2.x • Alembic     │
│  Products • Sales • Inventory │
│  Customers • Suppliers • etc. │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│    Business Intelligence      │
│  KPIs • Trends • Reports      │
│  Server-side aggregation      │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│     Predictive Analytics      │
│  Moving Average • Evaluation  │
│  MAE • RMSE • MASE            │
└───────────────┬───────────────┘
                │
                ▼
┌───────────────────────────────┐
│      Decision Support         │
│  7 Rule-Based Recommendations │
│  Alerts • Insights • Actions  │
└───────────────────────────────┘
```

---

## 🧩 Main System Modules

### 1. Authentication & Authorization

Provides secure access to the platform through:

* JWT authentication with expiry, issuer, and session invalidation
* Argon2id password hashing
* Permission-based access control (Business Owner, Manager, Staff)
* Protected API endpoints (default deny)
* Multi-tenant isolation from the authenticated `business_id` only

---

### 2. Product & Category Management

Manages the products sold by the retail business and their categories.

Core functionality includes:

* Product CRUD operations
* Product categorization
* Cost price and selling price tracking
* Reorder level configuration
* Active/inactive product status

---

### 3. Inventory Management

Provides visibility and control over stock.

Core functionality includes:

* Current stock levels per product
* Stock-in operations
* Stock-out operations
* Stock adjustments
* Inventory movement history with audit trail
* Low-stock identification against reorder levels

Inventory operations maintain data consistency through transactional database operations.

---

### 4. Sales & Transactions

Records retail sales and connects sales directly to inventory.

The sales workflow includes:

```text
Select Product
      ↓
Specify Quantity
      ↓
Validate Stock
      ↓
Snapshot name, SKU, selling price, and unit cost
      ↓
Record completed sale
      ↓
Reduce inventory (row lock)
      ↓
Record stock movement (SALE-{id})
```

Sales and inventory updates are handled in one transaction. Historical line prices do not change if the catalogue price is updated later.

---

### 5. Customer & Supplier Management

Manages business relationships:

* Customer records with contact information
* Customer type classification (retail/wholesale)
* Supplier records with contact details
* Supplier status management
* Customer-linked sales tracking

---

### 6. Expense Management

Tracks operational expenditures:

* Expense recording with category, amount, date
* Payment method tracking
* Description and notes
* Business-scoped expense queries
* Period-based expense aggregation for BI

---

### 7. Business Intelligence (F09)

The BI layer transforms operational data into useful information through:

* **Executive Dashboard:** KPI cards showing Revenue, Expenses, Net Cash Flow, Transactions, AOV, Low Stock
* **Sales Analytics:** Time-series trends (daily/monthly), revenue by category
* **Inventory Analytics:** Current stock health, valuation, low-stock counts
* **Server-side Aggregation:** All KPIs calculated via optimized SQL queries, not client-side processing
* **Date-range Filtering:** Configurable analysis periods with proper boundary handling

---

### 8. Predictive Analytics (F10)

The predictive analytics component provides:

* **Revenue and expense forecasting:** SMA, WMA, naive, and seasonal naive
* **Method selection:** rolling-origin MAE without using future periods
* **Inventory demand forecasting:** daily path, clamped at zero, with stockout notes
* **Evaluation:** MAE, RMSE, and MASE versus a naive baseline
* **Data quality:** labelled fallback when history is too short

The objective is to provide useful, explainable forecasts rather than unnecessarily complex machine-learning models.

---

### 9. Decision Support & Recommendations (F11)

The decision-support layer uses operational, BI and predictive information to provide:

* **7 Explainable Rules:** Low Stock, Stockout Risk, No Recent Sales, Revenue Decline, Revenue Concentration, Expense Increase, Expense Category Concentration
* **Severity Classification:** CRITICAL, HIGH, MEDIUM, LOW, INFO
* **Category Filtering:** Inventory, Sales, Expenses
* **Analysis Period Selection:** 3, 6, 9, or 12 complete calendar months
* **Data Quality Transparency:** Per-recommendation limitations and global analysis constraints
* **Role-Based Filtering:** Staff users receive inventory recommendations only
* **Advisory-Only Design:** Recommendations never automatically modify business records

---

## 🛠️ Technology Stack

### Backend

| Technology | Purpose |
|------------|---------|
| **FastAPI** | RESTful API framework |
| **Python 3.12** | Backend language |
| **SQLAlchemy 2.x** | ORM and database queries |
| **Alembic** | Database migrations |
| **Pydantic** | Request/response validation |
| **JWT (PyJWT)** | Signed access tokens with expiry and server-side revocation |
| **Argon2id** | Password hashing |
| **Uvicorn** | ASGI server |

### Frontend

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool and dev server |
| **React Router** | Client-side routing |
| **React Context** | Authentication state management |

### Database

| Technology | Purpose |
|------------|---------|
| **PostgreSQL** | Primary relational database |
| **Database name** | `sme_bi_platform` |

### Analytics

| Component | Implementation |
|-----------|---------------|
| Business Intelligence | Server-side SQL aggregation via SQLAlchemy |
| Predictive Analytics | Pure-Python moving average with evaluation metrics |
| Decision Support | Rule-based engine with explainable heuristics |
| Data Visualization | React components with CSS-based charts |

---

## 🗄️ Database

The primary application database is:

```text
sme_bi_platform
```

The application connects using a dedicated database account rather than the PostgreSQL superuser.

Example configuration:

```env
DATABASE_URL=postgresql+psycopg2://sme_app:your_secure_password@localhost:5432/sme_bi_platform
```

### Security

Secrets must **never** be committed to Git.

Use environment variables or an appropriate secrets-management mechanism.

Example:

```text
.env
```

should be excluded through `.gitignore`.

---

## 📂 Project Structure

```text
sme_bi_platform/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/
│   │   │       ├── auth.py
│   │   │       ├── users.py
│   │   │       ├── categories.py
│   │   │       ├── products.py
│   │   │       ├── customers.py
│   │   │       ├── suppliers.py
│   │   │       ├── inventory.py
│   │   │       ├── sales.py
│   │   │       ├── expenses.py
│   │   │       ├── analytics.py
│   │   │       ├── forecasting.py
│   │   │       └── recommendations.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   └── dependencies.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── business.py
│   │   │   ├── product.py
│   │   │   ├── category.py
│   │   │   ├── inventory.py
│   │   │   ├── sale.py
│   │   │   ├── customer.py
│   │   │   ├── supplier.py
│   │   │   └── expense.py
│   │   ├── schemas/
│   │   │   ├── analytics.py
│   │   │   ├── forecasting.py
│   │   │   └── recommendations.py
│   │   ├── services/
│   │   │   ├── forecasting.py
│   │   │   └── recommendations.py
│   │   └── main.py
│   ├── alembic/
│   │   └── versions/
│   ├── scripts/
│   │   ├── seed_demo_data.py
│   │   └── seed_historical_data.py
│   ├── venv/
│   ├── requirements.txt
│   └── alembic.ini
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   └── layout/
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── lib/
│   │   │   └── api.ts
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── BusinessAnalyticsPage.tsx
│   │   │   ├── SalesAnalyticsPage.tsx
│   │   │   ├── InventoryAnalyticsPage.tsx
│   │   │   ├── CustomerAnalyticsPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── ForecastingPage.tsx
│   │   │   ├── RecommendationsPage.tsx
│   │   │   ├── ExpensesPage.tsx
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── analyticsService.ts
│   │   │   ├── forecastingService.ts
│   │   │   └── recommendationsService.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── .gitignore
└── README.md
```

---

## 🔐 Security Principles

The application follows secure-development principles:

* Passwords are stored using Argon2id hashing.
* Authentication secrets (JWT SECRET_KEY) are stored outside source code.
* Backend authorization is enforced independently of the frontend.
* Database operations use SQLAlchemy ORM (parameterized queries).
* Input validation is performed server-side via Pydantic.
* Database constraints maintain data integrity (CHECK, UNIQUE, NOT NULL).
* Sensitive credentials are not logged.
* Application users operate with least-privilege database access.
* Inventory and sales operations use database transactions.
* Multi-tenant isolation enforced via `business_id` on every query.
* No client-supplied business ID is accepted as authority.

---

## 🔄 Development Roadmap

All phases have been completed:

```text
F01  Database Foundation              ✅ Complete
      ↓
F02  Authentication & Authorization   ✅ Complete
      ↓
F03  Products & Categories            ✅ Complete
      ↓
F04  Inventory Management             ✅ Complete
      ↓
F05  Sales & Transactions             ✅ Complete
      ↓
F06  Customers & Suppliers            ✅ Complete
      ↓
F07  Expense Management               ✅ Complete
      ↓
F08  Frontend Integration             ✅ Complete
      ↓
F09  Business Intelligence & KPIs     ✅ Complete
      ↓
F10  Predictive Analytics             ✅ Complete
      ↓
F11  Decision Support & Recommendations ✅ Complete
      ↓
F12  Testing, Evaluation & Documentation  🔄 In Progress
```

---

## 🧪 Testing

The system is tested at multiple levels:

### Functional Testing

Testing whether individual features work according to requirements.

### Integration Testing

Testing interactions between modules:

```text
Sales → Inventory (stock reduction)
Products → Sales (sale item validation)
Inventory → BI (low stock alerts)
Sales → BI (revenue aggregation)
Sales History → Forecasting (moving average)
Forecasting → Recommendations (stockout risk)
All Modules → Decision Support (rule evaluation)
```

### Security Testing

Testing:

* Authentication (valid/invalid tokens)
* Authorization (role-based access)
* Business isolation (cross-tenant data protection)
* Invalid input handling
* Unauthorized API requests (401/403 responses)
* Database constraint enforcement

### Usability Testing

Evaluating whether intended users can effectively interact with the system.

---

## 📊 Analytics Pipeline

The platform uses operational data for analytics:

```text
Products
   │
   ├──────────────┐
   │              │
Inventory       Sales       Expenses
   │              │              │
   └───────┬──────┘──────────────┘
           ↓
      Operational Data
           ↓
      Server-Side Aggregation
           ↓
    ┌──────┴──────┐
    ↓             ↓
   BI        Predictive Analytics
   (F09)          (F10)
    │             │
    └──────┬──────┘
           ↓
    Decision Support (F11)
           ↓
    Business Decisions
```

This architecture allows the system to evolve from a transactional retail application into an intelligent decision-support platform.

---

## 🎓 Academic Context

This project is being developed as a **B.Sc. Computing** project at **Cavendish University Zambia**, focusing on the practical integration of:

* Software Engineering
* Database Management
* Web Application Development
* Business Intelligence
* Data Analytics
* Predictive Analytics
* Human-Computer Interaction
* Decision Support Systems

The system is intended as an MVP/prototype and is **not designed to replace a full ERP, accounting, banking or enterprise resource planning system**.

### Data Disclaimer

The platform uses **synthetic demonstration data (DATA-01 and DATA-02)** for development and evaluation. All forecasting and recommendation results demonstrate methodology and system functionality. They do not represent real-world predictive accuracy or validated business predictions.

---

## 👨‍💻 Development Team

This is a collaborative group project.

Development responsibilities are divided across:

* Backend & Database
* Frontend & Analytics
* QA, Business Requirements & Documentation

All team members contribute to the development, testing, documentation and evaluation of the platform.

---

## ⚙️ Getting Started

### Prerequisites

Install the required software:

* **Git** — Version control
* **PostgreSQL** — Database server (version 14+)
* **Python 3.11+** — Backend runtime
* **Node.js 18+** — Frontend runtime
* **npm** — Frontend package manager

### Clone the Repository

```bash
git clone https://github.com/Dee5221/sme_bi_platform.git
cd sme_bi_platform
```

### Configure Environment Variables

Create a `.env` file in the `backend/` directory (see `backend/.env.example`):

```env
DATABASE_URL=postgresql+psycopg2://sme_app:your_secure_password@localhost:5432/sme_bi_platform
SECRET_KEY=replace-with-a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
ALLOWED_HOSTS=localhost,127.0.0.1,testserver
```

> ⚠️ **Never commit `.env` files to Git.** Ensure `.env` is listed in `.gitignore`.

### Database Setup

```bash
# Create the database
sudo -u postgres psql
CREATE DATABASE sme_bi_platform;
CREATE USER sme_app WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE sme_bi_platform TO sme_app;
\q
```

### Backend Setup & Startup

#### Step 1: Fix Uvicorn Path Conflicts

Before starting the backend, check and fix Python path issues:

```bash
# Check the current PYTHONPATH
echo $PYTHONPATH

# Clear the path if it contains conflicting entries
unset PYTHONPATH

# Confirm no system dist-packages are leaking into the venv
python -c "import sys; print([p for p in sys.path if 'dist-packages' in p])"

# If the above prints ['/usr/lib/python3/dist-packages'], disable system site packages:
sed -i 's/include-system-site-packages = true/include-system-site-packages = false/' venv/pyvenv.cfg

# Clear any PYTHONPATH that might add it:
unset PYTHONPATH
```

#### Step 2: Create and Activate Virtual Environment

```bash
cd backend

# Create virtual environment (if not already created)
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate          # macOS / Linux
# backend\venv\Scripts\activate   # Windows PowerShell
```

#### Step 3: Install Backend Dependencies

```bash
pip install -r requirements.txt
```

#### Step 4: Run Database Migrations

```bash
alembic upgrade head
```

#### Step 5: Seed Data (Local Development Only)

```bash
# Roles, business, and local evaluation users
python scripts/seed_db.py

# Catalogue, suppliers, customers, opening stock (DATA-01)
python scripts/seed_demo_data.py

# Historical sales and expenses (DATA-02)
python scripts/seed_historical_data.py
```

> ⚠️ These scripts are for local evaluation. They refuse to run when `ENVIRONMENT=production`. Do not deploy demonstration accounts. Do not rerun seed scripts if data already exists.

#### Step 6: Start the Backend Server

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Do not use `--reload` in production.

The backend API will be available at: `http://127.0.0.1:8000`

API documentation (Swagger UI) is available in development only: `http://127.0.0.1:8000/docs`

### Frontend Setup & Startup

#### Step 1: Install Frontend Dependencies

```bash
cd frontend
npm install
```

#### Step 2: Configure Frontend Environment (if needed)

Create a `.env` file in the `frontend/` directory if required:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
```

#### Step 3: Start the Frontend Development Server

```bash
npm run dev
```

The frontend will be available at: `http://localhost:5173`

#### Step 4: Build for Production (Optional)

```bash
npm run build
```

Production builds drop console/debugger output and call `/api` on the same origin unless `VITE_API_BASE_URL` is set. Do not put database credentials or signing keys in frontend environment files.

### Full Application Startup Summary

**Terminal 1 — Backend:**

```bash
cd backend
unset PYTHONPATH
source venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Terminal 2 — Frontend:**

```bash
cd frontend
npm run dev
```

---

## 🤝 Contribution Workflow

For group development:

1. Pull the latest changes.
2. Create a branch for your task.
3. Implement only the assigned functionality.
4. Test your changes.
5. Commit using a clear message.
6. Push the branch.
7. Open a Pull Request.
8. Review and merge after verification.

Example:

```bash
git checkout -b feature/inventory-management
```

Commit example:

```bash
git add .
git commit -m "feat: implement inventory management"
git push origin feature/inventory-management
```

Avoid committing:

* `.env`
* passwords
* API keys
* database credentials
* generated secrets
* `venv/` or `node_modules/`
* unnecessary build files

---

## 🧪 Automated tests

From `backend/` with the virtual environment active and PostgreSQL running:

```bash
pip install -r requirements-dev.txt
pytest
```

The acceptance suite covers role permissions, tenant isolation, sales snapshots and concurrent stock locks, forecasting rules, PDF reports, administration, self-service profile, security headers, and UI contracts.

Do not point `ENVIRONMENT=production` at the evaluation database while running seed scripts; those scripts are blocked in production.

---

## 🚀 Production deployment

1. Provision PostgreSQL and run `alembic upgrade head`. Do not run demo seed scripts.
2. Create the first owner with a real password:
   ```bash
   python scripts/provision_business.py
   ```
   The script creates roles if needed, then a business and Business Owner using the live user fields (`name`, `password_hash`, `role_id`). It is allowed in production. Do not use the demo seed scripts.
3. Set `backend/.env`:
   - `ENVIRONMENT=production`
   - a long random `SECRET_KEY` (at least 32 characters; weak keys are rejected)
   - `DATABASE_URL` for the production database
   - `CORS_ORIGINS` to the real frontend origin(s)
   - `ALLOWED_HOSTS` to the API hostname(s)
   - `AUTH_COOKIE_SECURE=true` behind HTTPS
4. Serve the API with uvicorn or gunicorn **without** `--reload`, behind HTTPS.
5. Build the frontend with `npm run build`. Leave `VITE_API_BASE_URL` empty and reverse-proxy `/api` to the backend so cookies stay first-party.
6. Do not expose `/docs`, database credentials, or signing keys to the browser.

Local development can keep `ENVIRONMENT=development` and `VITE_API_BASE_URL=http://127.0.0.1:8000`.

---

## ⚠️ Remaining limitations and risks

* **Not an ERP or accounting system.** Net cash flow is revenue minus recorded expenses. Gross profit uses snapshotted sale costs only; lines without a stored cost are omitted.
* **Forecasts are statistical baselines**, not trained machine-learning models. Results on synthetic evaluation data do not prove real-world predictive accuracy.
* **Recommendations are advisory.** They never write stock or financial records.
* **Session storage.** Login rate limits and token revocation live in process memory. Multiple API workers will not share them. For a multi-process deploy, use a shared store.
* **Tokens.** The SPA still holds a session token for local cross-origin use. Prefer same-origin HTTPS with the HttpOnly cookie in production.
* **Profile photos** are not stored. Initials are shown instead. Phone is not a user field; business contact lives in Business Settings.
* **In-memory login limiter** can be cleared by a process restart.
* **HCI checks** for skip-link, dialog lock, and focus styles are source contracts plus earlier browser passes, not a full automated browser suite.

See `PROJECT_STRUCTURE.md` for the role access matrix.

---

## 📜 Project Status

**Current status: Functional completion, security hardening, and automated tests — documentation current**

| Module | Status |
|--------|--------|
| Database Foundation | ✅ Complete |
| Authentication & Authorization | ✅ Complete |
| Products & Categories | ✅ Complete |
| Inventory Management | ✅ Complete |
| Sales & Transactions | ✅ Complete |
| Customers & Suppliers | ✅ Complete |
| Expense Management | ✅ Complete |
| Business Intelligence (F09) | ✅ Complete |
| Predictive Analytics (F10) | ✅ Complete |
| Decision Support (F11) | ✅ Complete |
| PDF reports | ✅ Complete |
| User / roles / audit / settings | ✅ Complete |
| Security and production config | ✅ Complete |
| Automated tests | ✅ 102 passed |
| Documentation | ✅ Complete |

---

## 📄 License

This project is currently developed for academic purposes at Cavendish University Zambia.

License terms can be added when the team decides how the project will be distributed or reused.
