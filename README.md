# Grocery List Manager — Local Dev (Phase 0)

This repository contains a minimal scaffold for the Grocery List Manager MVP and a Docker Compose setup for local development.

Quick start (requires Docker & Docker Compose):

```bash
# copy the example env
cp .env.example .env

# build and start the stack
docker compose up --build

# backend health endpoint
curl http://localhost:4000/health

# frontend is available at http://localhost:3000
# Adminer (DB UI) at http://localhost:8081
```

Notes:
- The backend is a minimal Express server on port 4000 with a `/health` and `/api/ping` endpoint.
- The frontend is a placeholder Vite + React app served by nginx on port 3000.
- PostgreSQL data is stored in a named Docker volume `db-data`.
