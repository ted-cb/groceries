# Grocery List Manager

Authenticated grocery lists with multi-device **refresh-on-load** sync, save status indicators, and write retries.

## Quick start (Docker)

Requires Docker & Docker Compose.

```bash
cp .env.example .env
docker compose up --build
```

- App: http://localhost:3000
- API health: http://localhost:4000/health (also proxied at http://localhost:3000/health)
- Adminer: http://localhost:8081

### Try categories

1. Open http://localhost:3000 — log in or create an account
2. Open a list and add items with different categories — they group by aisle
3. Open **Categories** to create, rename, reorder (↑/↓), or delete with reassignment
4. Return to a list — groups follow your category order

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

## Current scope

| Feature | Status |
|---------|--------|
| Register / login / logout | Done |
| Lists overview CRUD | Done |
| List detail + items / quick-add | Done |
| Default categories seeded on register | Done |
| Group items by category on list detail | Done |
| Category management (create / rename / reorder / delete + reassign) | Done |
| Check-off / shopping flow | Done |
| Drag-and-drop reorder (items & categories) | Done |
| Sync status, write retries, conflict refresh | Done (Phase 7) |
| Accessibility, polish, tests | Phase 8 |

## API surface (auth required unless noted)

### Lists

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/lists` | All lists (with item counts) |
| POST | `/api/lists` | Create list |
| GET | `/api/lists/:listId` | List metadata + counts |
| PATCH | `/api/lists/:listId` | Rename / update description |
| DELETE | `/api/lists/:listId` | Delete list (items cascade) |

### Items

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/lists/:listId/items` | Items for a list |
| POST | `/api/lists/:listId/items` | Add item |
| PATCH | `/api/items/:itemId` | Edit item fields |
| DELETE | `/api/items/:itemId` | Delete item |

### Categories

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/categories` | Categories (sort order + item counts) |
| POST | `/api/categories` | Create custom category |
| PUT | `/api/categories/reorder` | Set full order (`orderedIds`) |
| PATCH | `/api/categories/:categoryId` | Rename / set sortOrder |
| DELETE | `/api/categories/:categoryId` | Delete; body `{ reassignToCategoryId }` |

## Deploy notes (session cookies)

After login/register the app sets an httpOnly `session` cookie. Protected routes
(`GET /api/lists`, etc.) require that cookie.

| How users open the app | Set `COOKIE_SECURE` |
|------------------------|---------------------|
| `http://server:3000` (plain HTTP) | `false` (default) |
| `https://…` (TLS to the browser) | `true` |

If `COOKIE_SECURE=true` on plain HTTP, browsers **drop** the cookie. Login still
looks successful (user is in the JSON response), but the next API call returns
**Authentication required**.

For GitHub Actions deploys, set environment variable `COOKIE_SECURE` on the
`production` environment if you serve HTTPS; leave unset/`false` for HTTP.

## Stack

- Frontend: React + Vite + React Router + TanStack Query
- Backend: Express + Prisma + PostgreSQL
- Auth: Argon2id passwords, server sessions, httpOnly cookies
- Deploy: Docker Compose; frontend nginx proxies `/api` for same-origin cookies
