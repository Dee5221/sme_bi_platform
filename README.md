# SME Intelligence Platform

Intelligent SME Business Intelligence and Decision-Support Platform.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Node.js + Express + TypeScript
- Database: SQLite via Prisma (MySQL-ready schema)
- Auth: JWT in HTTP-only cookies + permission RBAC

## Getting started

### Backend

```bash
cd backend
npm install
cp .env.example .env
npx prisma migrate dev
npm run prisma:seed
npm run dev
```

API: http://localhost:4000

### Seed data — AM Financial Solutions

Running `npm run prisma:seed` clears all businesses and users, then creates one test company with the accounts below.

| Role | Email | Password |
|------|-------|----------|
| Owner / Manager | `owner@amfinancial.local` | `OwnerPass1` |
| Administrator | `admin@amfinancial.local` | `AdminPass1` |
| Staff | `staff@amfinancial.local` | `StaffPass1` |
| External Customer | `customer@amfinancial.local` | `CustomerPass1` |
| External Supplier | `supplier@amfinancial.local` | `SupplierPass1` |

Customer records (no login): Grace Mwamba, John Banda, Mary Phiri.  
Supplier record: Capital Supplies Ltd. Portal customer/supplier logins are linked to Grace Mwamba and Capital Supplies Ltd.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

UI: http://localhost:5173

### Tests

```bash
cd backend
npm test
```

## Current milestone

Foundation (Auth + RBAC + App Shell + Design System) for Role 1 — Owner / Manager.
