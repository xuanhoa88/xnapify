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

## Build & Run

```bash
# Build and start app (SQLite, default)
docker compose -f .docker/docker-compose.yml up -d --build

# With PostgreSQL
docker compose -f .docker/docker-compose.yml --profile postgres up -d --build

# With MySQL
docker compose -f .docker/docker-compose.yml --profile mysql up -d --build

# View logs
docker compose -f .docker/docker-compose.yml logs -f app

# Stop all
docker compose -f .docker/docker-compose.yml down
```

## Important: Webpack DefinePlugin

> **All `RSK_*` env vars are baked into the server bundle at build time** via Webpack's
> `DefinePlugin`. Runtime `environment:` overrides in `docker-compose.yml` have **no effect**
> on values already replaced during `npm run build`.

To change baked values for Docker builds, set them in the Dockerfile's `RUN` command:
```dockerfile
RUN RSK_HOST=0.0.0.0 npm run build
```

## When Database URL Changes

If switching from SQLite to Postgres/MySQL for Docker, you must change `RSK_DB_URL` in
`.env.rsk` (the file included in the Docker build context) so Webpack bakes the correct
connection string. Or pass it as a build arg to override at build time.

## Debugging

```bash
# Check container status
docker compose -f .docker/docker-compose.yml ps

# Exec into running container
docker compose -f .docker/docker-compose.yml exec app sh

# Inspect env vars inside container
docker compose -f .docker/docker-compose.yml exec app env | grep RSK_

# Rebuild without cache
docker compose -f .docker/docker-compose.yml build --no-cache app
```
