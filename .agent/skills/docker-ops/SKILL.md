---
name: docker-ops
description: Docker build, compose, and containerization patterns. Use when modifying Dockerfile, docker-compose, or container infrastructure.
---

# Docker Operations Skill

## File Layout

All Docker files live in `.docker/` at the project root:

```
.docker/
├── Dockerfile           # Multi-stage build (builder → production)
├── docker-compose.yml   # Service definitions
└── entrypoint.sh        # su-exec permission fixer
```

The `.dockerignore` stays in the **project root** (Docker requirement — must be at build context root).

## Architecture

### Multi-Stage Build
1. **Builder stage** (`node:18-alpine`): Installs all deps, runs `npm run build`
2. **Production stage** (`node:18-alpine`): Copies built output + `node_modules`, installs `su-exec`

### Entrypoint
The `entrypoint.sh` script runs as root to fix volume ownership, then drops privileges via `su-exec node`.

- Uses **conditional** `chown -R` — only runs when ownership is wrong (avoids O(n) walk on every restart)
- Fixes: `/app/build` (SQLite), `/app/build/extensions` (bundled extensions need write for `npm install`), `/app/data` (persistent volume)

### Build Context
- `build.context` is `..` (project root) so Webpack can access all source files
- `dockerfile` points to `.docker/Dockerfile`
- `env_file` points to `../.env`

## Critical: DefinePlugin Constraint

Webpack's `DefinePlugin` replaces all `process.env.RSK_*` references with **literal strings at build time**. This means:

- `RSK_HOST`, `RSK_DB_URL`, `RSK_PORT`, etc. are **hardcoded** in the bundle
- Docker `environment:` overrides in `docker-compose.yml` are **ignored** for baked values
- To change them for Docker: set env vars in the `RUN` command before `npm run build`

```dockerfile
# Correct: set before build
RUN RSK_HOST=0.0.0.0 RSK_DB_URL=postgresql://... npm run build

# Wrong: runtime override has no effect on baked values
environment:
  RSK_HOST: 0.0.0.0  # ignored if already baked
```

## Conventions

- **Single persistent volume**: `rsk_data` mounted at `/app/data` — all writable dirs are subdirectories
- Writable dirs set via env vars: `RSK_UPLOAD_DIR`, `RSK_NODERED_HOME`, `RSK_EXTENSION_DIR`, `RSK_CACHE_DIR`, `RSK_FTS_DIR`
- Volume names use `rsk_` prefix: `rsk_data`, `rsk_pg`, `rsk_mysql`
- Network: `rsk-net` (bridge driver)
- Container names: `rsk-app`, `rsk-postgres`, `rsk-mysql`
- Optional services use Docker Compose profiles: `--profile postgres`, `--profile mysql`
- Health checks are defined for all services

## Modifying Docker Config

When editing `.docker/Dockerfile`:
1. Keep the multi-stage pattern (builder → production)
2. Always set `RSK_HOST=0.0.0.0` in the build command
3. Copy `node_modules` from builder (not `npm install --production`) because `core-js` is a devDependency required at runtime
4. Keep `su-exec` + entrypoint pattern for volume permissions

When editing `.docker/docker-compose.yml`:
1. `build.context` must be `..` (parent directory)
2. `env_file` must be `../.env`
3. Use profiles for optional database services
4. All volumes and networks use named references
