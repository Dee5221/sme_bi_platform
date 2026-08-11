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

Demo owner:

- Email: `owner@demo-sme.local`
- Password: `OwnerDemo1`

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
