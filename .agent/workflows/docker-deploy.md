---
description: Build, run, and manage Docker containers for local and production use
---

Build and manage the application using Docker Compose from the `.docker/` directory.

## File Locations

All Docker configuration lives in `.docker/`:
- `.docker/Dockerfile` — Multi-stage build (builder → production)
- `.docker/docker-compose.yml` — Service definitions (app, postgres, mysql)
- `.docker/entrypoint.sh` — Runtime permission fixer via `su-exec`
- `.dockerignore` — Build context exclusions (stays in project root)

## Build & Run (Production)

```bash
# Build and start app (SQLite, default)
docker compose -f .docker/docker-compose.yml up -d --build

# With PostgreSQL
docker compose -f .docker/docker-compose.yml --profile postgres up -d --build

# With MySQL
docker compose -f .docker/docker-compose.yml --profile mysql up -d --build

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

# With PostgreSQL
docker compose -f .docker/docker-compose.dev.yml --profile postgres up --build

# Stop
docker compose -f .docker/docker-compose.dev.yml down
```

Key differences from production:
- Source is bind-mounted (`..:/app`) — edits on host trigger HMR
- `node_modules` uses anonymous volume to isolate Linux binaries from host
- `CHOKIDAR_USEPOLLING=true` enables filesystem polling inside the container
- Runs `npm run dev` instead of `npm run build` + `node server.js`

## Important: Webpack DefinePlugin

> **All `XNAPIFY_*` env vars are baked into the server bundle at build time** via Webpack's
> `DefinePlugin`. Runtime `environment:` overrides in `docker-compose.yml` have **no effect**
> on values already replaced during `npm run build`.

To change baked values for Docker builds, set them in the Dockerfile's `RUN` command:
```dockerfile
RUN XNAPIFY_HOST=0.0.0.0 npm run build
```

## When Database URL Changes

If switching from SQLite to Postgres/MySQL for Docker, you must change `XNAPIFY_DB_URL` in
`.env.xnapify` (the file included in the Docker build context) so Webpack bakes the correct
connection string. Or pass it as a build arg to override at build time.

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
