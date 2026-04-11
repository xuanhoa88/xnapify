---
description: Build, run, and manage Docker containers for local and production use
---

Build and manage the application using Docker Compose from the `.docker/` directory.

## File Locations

All Docker configuration lives in `.docker/`:

- `.docker/Dockerfile` — Multi-stage build (builder → production)
- `.docker/docker-compose.yml` — Service definitions (app only — DB is embedded)
- `.docker/entrypoint.sh` — Runtime permission fixer via `su-exec`
- `.dockerignore` — Build context exclusions (stays in project root)

## Build & Run (Production)

```bash
# Build and start app (all DB drivers pre-installed — SQLite default)
docker compose -f .docker/docker-compose.yml up -d --build

# View logs
docker compose -f .docker/docker-compose.yml logs -f xnapify

# Stop all
docker compose -f .docker/docker-compose.yml down
```

## Build & Run (Development with HMR)

Uses `.docker/docker-compose.dev.yml` with bind-mounted source and polling for live reload.

```bash
# Start dev server with HMR
docker compose -f .docker/docker-compose.dev.yml up --build

# Podman equivalent
podman compose -f .docker/docker-compose.dev.yml up --build

# Stop
docker compose -f .docker/docker-compose.dev.yml down
```

Key differences from production:

- Source is bind-mounted (`..:/app`) — edits on host trigger HMR
- `node_modules` uses anonymous volume to isolate Linux binaries from host
- `CHOKIDAR_USEPOLLING=true` enables filesystem polling inside the container
- Runs `npm run dev` instead of `npm run build` + `npm start`

## Important: Webpack DefinePlugin

> **All `XNAPIFY_*` env vars are baked into the server bundle at build time** via Webpack's
> `DefinePlugin`. Runtime `environment:` overrides in `docker-compose.yml` have **no effect**
> on values already replaced during `npm run build`.

To change baked values for Docker builds, set them in the Dockerfile's `RUN` command:

```dockerfile
RUN XNAPIFY_HOST=0.0.0.0 npm run build
```

## Database Configuration

The Docker image ships with all 3 database drivers pre-installed (sqlite3, pg, mysql2).
Switch databases at runtime by setting `XNAPIFY_DB_URL`:

```yaml
environment:
  XNAPIFY_DB_URL: postgresql://user:pass@host:5432/dbname   # External PG
  XNAPIFY_DB_URL: mysql://user:pass@host:3306/dbname        # External MySQL
  XNAPIFY_DB_URL: sqlite:database.sqlite                    # SQLite (default)
```

Data directories control where each database stores files:
- `XNAPIFY_SQLITE_DATA_DIR` — SQLite database file (default: `/app/data/sqlite` in Docker)
- `XNAPIFY_PG_DATA_DIR` — PostgreSQL data (default: `/app/data/postgres` in Docker)
- `XNAPIFY_MYSQL_DATA_DIR` — MySQL data (default: `/app/data/mysql` in Docker)

Manual DB control inside the container:

```bash
# Auto-detect from env
node tools/npm/preboot.js --start
node tools/npm/preboot.js --stop

# Force specific dialect
node tools/npm/preboot.js --db mysql --start
node tools/npm/preboot.js --db postgres --stop

# Install driver only (no server start — used by Dockerfile)
node tools/npm/preboot.js --db sqlite --install
```

## Debugging

```bash
# Check container status
docker compose -f .docker/docker-compose.yml ps

# Exec into running container
docker compose -f .docker/docker-compose.yml exec xnapify sh

# Inspect env vars inside container
docker compose -f .docker/docker-compose.yml exec xnapify env | grep XNAPIFY_

# Rebuild without cache
docker compose -f .docker/docker-compose.yml build --no-cache xnapify
```
