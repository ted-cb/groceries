# Grocery List Manager

Authenticated grocery lists with multi-device refresh-on-load sync. Phase 1 delivers registration, login, logout, protected routes, and session cookies.

## Quick start (Docker)

Requires Docker & Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

- App: http://localhost:3000
- API health: http://localhost:4000/health (also proxied at http://localhost:3000/health)
- Adminer: http://localhost:8081

### Try auth

1. Open http://localhost:3000 — you should land on **Log in**
2. Create an account (password ≥ 8 characters)
3. You reach the protected home shell
4. Refresh the page — you stay signed in
5. Log out — you return to login and cannot open `/` without signing in again

## Local development (without full Compose for FE/BE)

```bash
# Terminal 1 — database
docker compose up db -d

# Terminal 2 — API
cd backend
cp ../.env.example .env   # set DATABASE_URL to localhost
# DATABASE_URL=postgresql://postgres:password@localhost:5432/groceries
# CORS_ORIGIN=http://localhost:5173
npm install
npx prisma generate
npx prisma db push
npm run dev

# Terminal 3 — frontend
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://localhost:4000`.

## Phase 1 scope

| Feature | Status |
|---------|--------|
| Register (email/password) | Done |
| Login / logout | Done |
| httpOnly session cookie (30 days) | Done |
| Protected home shell | Done |
| Seed default categories on register | Done (API only; UI later) |
| Lists CRUD | Phase 2 |

## Stack

- Frontend: React + Vite + React Router + TanStack Query
- Backend: Express + Prisma + PostgreSQL
- Auth: Argon2id passwords, server sessions, httpOnly cookies
- Deploy: Docker Compose; frontend nginx proxies `/api` for same-origin cookies
