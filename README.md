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

Remote Docker deployment

1. Copy the example environment file on the target machine and adjust the ports and database credentials:

   ```bash
   cp .env.example .env
   nano .env
   ```

2. Start the stack on the target machine:

   ```bash
   docker compose up -d --build
   ```

3. To update later, run:

   ```bash
   docker compose pull
   docker compose up -d --build
   ```

GitHub Actions with a self-hosted runner

1. Install a GitHub Actions runner on the Docker host machine.
2. In your GitHub repository, create these secrets:
   - `POSTGRES_USER`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_DB`
   - `DATABASE_URL` (optional if you want to override the default)
3. Optionally add repository variables:
   - `BACKEND_PORT`
   - `FRONTEND_PORT`
   - `ADMINER_PORT`
   - `DB_PORT`
4. Push to the `main` branch to trigger deployment automatically.

The repository includes a workflow in [.github/workflows/deploy.yml](.github/workflows/deploy.yml) that uses the self-hosted runner to build and start the stack on the target machine.
