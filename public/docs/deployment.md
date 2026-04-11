# Deployment Guide

This guide covers the deployment process for xnapify, whether you are running it locally, on a bare-metal server, or within a Docker container.

## Prerequisites

- Node.js ≥ 16.14.0
- npm ≥ 8.0.0
- (Optional) Docker and Docker Compose (or Podman)

---

## 1. Local Production Build

To build and deploy the application on a local server or VM without Docker:

```bash
# 1. Install all project dependencies (root + sub-packages)
npm run setup

# 2. Build the production bundle
npm run build

# 3. Change into the build output directory
cd build

# 4. Install only production dependencies for the built app
npm run setup

# 5. Start the production server
npm start
```

### Environment Variables
Environment variables (prefixed with `XNAPIFY_`) are baked into the client bundle during the `npm run build` step via Webpack's `DefinePlugin`. 
Copy `.env.xnapify` to `.env` and configure your settings *before* running the build process.

---

## 2. Docker Deployment

All Docker configuration lives in the `.docker/` directory. The Docker image ships with all three database drivers pre-installed (`sqlite3`, `pg`, `mysql2`).

### Production Deployment

To build and run the application using Docker Compose:

```bash
# Build and start app in detached mode
docker compose -f .docker/docker-compose.yml up -d --build

# View application logs
docker compose -f .docker/docker-compose.yml logs -f xnapify

# Stop and tear down the container
docker compose -f .docker/docker-compose.yml down
```

### Development with HMR

For local development with Hot Module Replacement (HMR) and live-reloading:

```bash
# Start dev server with HMR using Docker Compose
docker compose -f .docker/docker-compose.dev.yml up --build

# Start dev server with HMR using Podman (equivalent)
podman compose -f .docker/docker-compose.dev.yml up --build
```
*Note: The `docker-compose.dev.yml` configuration bind-mounts your local source code so that edits instantly trigger Webpack HMR inside the container.*

### Important: Webpack DefinePlugin

> **⚠️ Warning:** All `XNAPIFY_*` variables are baked into the server bundle at build time. Runtime overrides in `docker-compose.yml` under the `environment:` key will have **no effect** for values injected during the React/Webpack build.

If you need to change client-side baked values for Docker builds, you must pass and set them in the `Dockerfile` before the `RUN npm run build` directive:

```dockerfile
# Example inside a Dockerfile
RUN XNAPIFY_HOST=0.0.0.0 npm run build
```

---

## 3. Database Configuration

By default, xnapify uses an embedded **SQLite** database that requires zero configuration. You can switch the active database at runtime by setting the `XNAPIFY_DB_URL` environment variable:

- **SQLite (Default):** `XNAPIFY_DB_URL=sqlite:database.sqlite`
- **PostgreSQL:** `XNAPIFY_DB_URL=postgresql://user:pass@host:5432/dbname`
- **MySQL:** `XNAPIFY_DB_URL=mysql://user:pass@host:3306/dbname`

You can pass the connection string via your `.env` file or directly to the Docker Compose `environment` block depending on the environment.

### Using Embedded Database Servers

If you don't have an external relational database available, xnapify can automatically download and run embedded, portable database daemon versions of Postgres and MySQL on-demand:

```bash
# Start the production server with the embedded MySQL database
XNAPIFY_DB_TYPE=mysql npm start

# Start the production server with the embedded PostgreSQL database
XNAPIFY_DB_TYPE=postgres npm start
```

---

## 4. Troubleshooting

- **Locally building errors:** Try `npm run clean && npm run build`. Ensure your node dependencies are fully instated using `npm run setup`. If necessary, run with `LOG_LEVEL=verbose` for granular details.
- **Docker/Podman startup errors:** Make sure you aren't encountering file permission issues. You can verify the container status `docker compose -f .docker/docker-compose.yml ps`.
- **Database issues:** Check if your dialect driver successfully installed inside the Docker image or the output directory dependencies.
