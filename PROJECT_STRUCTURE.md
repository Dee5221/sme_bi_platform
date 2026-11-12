# Project Structure, Features, and Role Access

This document describes how the SME Business Intelligence platform is organised, what each module does, and what **Business Owner**, **Manager**, and **Staff** can access.

The platform is a web-based BI and decision-support system for small and medium retail businesses. Operational data (sales, inventory, products, customers, suppliers, expenses) is stored in PostgreSQL, then used for dashboards, forecasts, recommendations, and PDF reports.

Authorization is **default deny**. The backend permission registry is the source of truth. The frontend hides routes and buttons, but hiding a link does not grant access.

---

## 1. High-level architecture

```text
React frontend (Vite)          FastAPI backend              PostgreSQL 16
localhost:5173          -->    127.0.0.1:8000         -->   sme_bi_platform
                                 JWT + permission RBAC
                                 tenant isolation by
                                 authenticated business_id
```

| Layer | Technology | Responsibility |
|-------|------------|----------------|
| Frontend | React 18, TypeScript, Vite 5 | Screens, forms, charts, permission-aware navigation |
| Backend | FastAPI, SQLAlchemy 2, Alembic | REST API, auth, business rules, analytics, PDFs |
| Database | PostgreSQL | Multi-tenant retail and analytics data |
| Forecasting | Pure Python (SMA, WMA, naive, seasonal naive) | Revenue, expense, and demand forecasts |
| Decision support | Rule engine plus profit-aware rules | Advisory alerts only |
| Reports | fpdf2 | Tenant-scoped PDF downloads |

Every protected query is scoped to the authenticated user’s `business_id`. A client-supplied business id is never treated as proof of access.

---

## 2. Repository structure

```text
Platform_based_application/
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI app, CORS, security headers, routers
│   │   ├── api/v1/                 # REST endpoints
│   │   ├── core/                   # Config, JWT, permissions, rate limit
│   │   ├── models/                 # SQLAlchemy tables
│   │   ├── schemas/                # Pydantic request/response models
│   │   └── services/               # Sales, forecasts, recommendations, PDFs, users
│   ├── alembic/                    # Database migrations
│   ├── scripts/                    # Dev seed scripts and provisioning
│   ├── tests/                      # Pytest acceptance suite
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Permission-gated routes
│   │   ├── context/AuthContext.tsx
│   │   ├── components/             # Shell, dialogs, shared UI
│   │   ├── pages/
│   │   ├── services/
│   │   └── lib/api.ts
│   ├── .env.example
│   └── vite.config.ts
├── PROJECT_STRUCTURE.md
└── README.md
```

### Backend folders

| Folder | Purpose |
|--------|---------|
| `app/api/v1/` | HTTP routes. |
| `app/core/` | Settings, database session, JWT, permission checks, security headers. |
| `app/models/` | Tables: businesses, users, products, sales, inventory, expenses, audit logs. |
| `app/schemas/` | Validation of incoming JSON and outgoing responses. |
| `app/services/` | Sales integrity, forecasting, recommendations, PDF assembly, user admin. |
| `alembic/` | Versioned schema migrations. |
| `scripts/` | Development seed scripts (blocked in production) and `provision_business.py`. |
| `tests/` | Automated API and acceptance tests. |

### Frontend folders

| Folder | Purpose |
|--------|---------|
| `src/pages/` | Application screens. |
| `src/components/layout/` | Sidebar, top bar, skip link, authenticated shell. |
| `src/components/ui/` | Buttons, tables, cards, dialogs, focus/scroll lock. |
| `src/context/` | Auth: current user, login/logout, `hasPermission()`. |
| `src/services/` | Typed wrappers around backend endpoints. |
| `src/lib/api.ts` | Shared `fetch` helper with credentials. API base comes from `VITE_API_BASE_URL`. |

### Main frontend routes

| Route | Screen | Permission |
|-------|--------|------------|
| `/login` | Sign in | Public |
| `/app` | Role dashboard | Signed in |
| `/app/sales/new` | Point of sale | `sales.create` |
| `/app/sales/history` | Sales history | `sales.view_own` or `sales.view_all` |
| `/app/products` | Products | `products.view` |
| `/app/categories` | Categories | `products.manage` |
| `/app/inventory` | Stock levels | `inventory.view` |
| `/app/inventory/stock-in` | Receive stock | `inventory.manage` |
| `/app/inventory/stock-out` | Issue / adjust stock | `inventory.manage` |
| `/app/inventory/movements` | Stock movement history | `inventory.view` |
| `/app/customers` | Customers | `customers.view` |
| `/app/suppliers` | Suppliers | `suppliers.view` |
| `/app/expenses` | Expenses | `expenses.view` |
| `/app/analytics/*` | Business, sales, inventory, customer analytics | `analytics.view` |
| `/app/forecasting` | Demand and revenue forecasts | `forecasting.view` |
| `/app/recommendations` | Decision-support alerts | `recommendations.view` |
| `/app/reports` | PDF report generation | `reports.generate` |
| `/app/users` | User administration | `users.view` |
| `/app/roles` | Roles and permission matrix | `roles.view` |
| `/app/activity-log` | Activity log | `audit.view` |
| `/app/business-settings` | Business profile | `business.settings.manage` |
| `/app/profile` | Own name, email, and password | `profile.manage` |

---

## 3. Functionalities

### Authentication and security

- JWT login (`POST /api/auth/login`) with Argon2id password hashing.
- Tokens carry expiry, issuer, `jti`, and version. Logout, admin password reset, and self-service password change invalidate previous sessions.
- Signed-in users update their own name, email, and password at `GET`/`PUT /api/profile` and `PUT /api/profile/password`. First and last name are stored as a single `users.name` value.
- HttpOnly cookie is set; the SPA also keeps a session-storage token for local cross-origin development.
- Inactive accounts cannot sign in. Login failures share one message and are rate-limited.
- CORS, trusted hosts, and security headers are environment-based.
- API docs (`/docs`) are off when `ENVIRONMENT=production`.

### Core operations

| Module | What it does |
|--------|----------------|
| **Products & categories** | Catalogue with SKU, cost, selling price, reorder level. Staff cannot see cost or change selling price. Only Owner can change selling price. |
| **Inventory** | On-hand quantity, stock-in, stock-out, adjustments, movement history. POS deductions use row locks. |
| **Sales** | Completed sales snapshot product name, SKU, selling price, and unit cost. Inventory is reduced in the same transaction. Staff see only their own sales. |
| **Customers** | Customer records. Staff may create a customer during a sale. |
| **Suppliers** | Supplier records. Staff cannot view this module. |
| **Expenses** | Operating costs. Staff cannot view this module. |

### Business intelligence

Server-side SQL aggregation for the authenticated business only:

- Revenue, expenses, net cash flow (revenue minus expenses — not accounting net profit)
- Transaction count and average order value
- Low-stock count
- Sales trend and revenue by category
- Product performance and gross profit from **snapshotted** sale-item costs

Gross profit never applies the current product `cost_price` to historical lines. Lines without a stored cost are excluded.

### Predictive analytics

- SMA, WMA (0.50 / 0.30 / 0.20), naive, and seasonal naive
- Rolling-origin MAE / RMSE / MASE; method selected without future-data leakage
- Demand forecasts are clamped at zero
- Insufficient history falls back to a labelled naive forecast

### Decision support

Recommendations are advisory. They never change stock, sales, or expenses.

Staff do not receive recommendation or forecast screens. Owners and Managers receive inventory, sales, expense, and profit-aware rules where cost snapshots exist.

### PDF reports

Owner and Manager can generate tenant-scoped PDFs (sales, product performance, inventory, expenses, gross profit, forecasts/recommendations, business summary). Staff cannot.

### Administration

Owner-only: employee accounts, role assignment (Manager or Staff only), activity log, business settings. Permission sets are locked; they cannot be edited in the UI.

---

## 4. User roles

| Role | Purpose |
|------|---------|
| **Business Owner** | Strategic and administrative control: operations, BI, forecasts, reports, users, settings. |
| **Manager** | Day-to-day operations, expenses, analytics, forecasts, reports. Cannot manage users, roles, audit, or settings. Cannot change selling prices. |
| **Staff** (Sales Staff) | Point of sale, own sales history, product lookup, customer lookup. No BI, costs, forecasts, reports, or administration. |

Local evaluation accounts are created only by development seed scripts. Those scripts refuse to run when `ENVIRONMENT=production`. Demonstration passwords are not shown in the application. For a live system, create a real owner account rather than deploying seed users.

---

## 5. Access matrix

Legend:

- **Full** — view and change where the API supports it
- **View** — read only
- **Create** — can add records
- **Own** — only records created by this user
- **No** — blocked by UI route and API permission (403)

| Area | Business Owner | Manager | Staff |
|------|----------------|---------|-------|
| Sign in | Full | Full | Full |
| Own dashboard | Owner KPIs, profit, forecasts | Manager KPIs, profit, forecasts | Own sales overview only |
| **Sales** | | | |
| New sale (POS) | Full | Full | Create |
| Sales history | All cashiers | All cashiers | Own only |
| **Operations** | | | |
| Products | Full, including selling price and cost | Create / update (no selling-price change); can view cost | View selling price only |
| Categories | Full | Full | No |
| Inventory levels | Full | Full | View |
| Stock in / out / adjust | Full | Full | No |
| Stock movements | Full | Full | View |
| Customers | Full | Full | View / create |
| Suppliers | Full | Full | No |
| Expenses | Full | Full | No |
| **Intelligence** | | | |
| Analytics dashboards | Full | Full | No |
| Forecasting | Full | Full | No |
| Recommendations | Full | Full | No |
| PDF reports | Full | Full | No |
| **Administration** | | | |
| Own profile / password | Full | Full | Full |
| Users | Full | No | No |
| Roles & permissions | View (locked matrix) | No | No |
| Activity log | View | No | No |
| Business settings | Full | No | No |

### What this means in practice

**Business Owner** runs the business: catalogue, stock, sales, people, money, dashboards, forecasts, reports, and employee accounts.

**Manager** runs the shop day to day: sell, receive and adjust stock, maintain products (except selling price), customers, suppliers, and expenses, and use analytics and PDFs. They cannot create users or change settings.

**Staff** serves customers:

- Record a sale; stock is reduced as part of that sale
- See their own completed sales with snapshotted line details
- Look up products (no cost) and customers
- Cannot open analytics, forecasting, reports, expenses, suppliers, or administration

---

## 6. How a request is authorised

```text
1. User signs in. The API returns a JWT and sets an HttpOnly cookie.
2. Frontend stores a session token (not localStorage) and loads /api/auth/me.
3. /me returns the role name and the permission list from the server registry.
4. Routes and sidebar items require those permission keys.
5. Every protected endpoint uses require_permission(...) and queries by current_user.business_id.
6. Inactive users, revoked tokens, and missing permissions are rejected (401 or 403).
```

Authorization is enforced on the server. The frontend only hides actions a role should not use.
