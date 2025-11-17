# Environment Variables Guide

## Overview

React Starter Kit uses environment variables for configuration. This guide explains how they work in development, build, and production.

## How It Works

### Development & Build

**Uses `.env` file:**

```javascript
// tools/run.js
require('dotenv').config({ override: true }); // Loads .env file
```

**Setup:**

```bash
# Copy example file
cp .env.defaults .env

# Edit values
nano .env

# Run
npm start  # Loads .env automatically
npm run build  # Loads .env automatically
```

### Production

**Uses server environment variables:**

```bash
# Set directly on server (no .env file)
export NODE_ENV=production
export RSK_PORT=3000
export RSK_JWT_SECRET=your-secret

# Run
node build/server.js
```

## Variable Types

### 1. Build-Time Variables

Used during `npm run build`:

| Variable                       | Default       | Description            |
| ------------------------------ | ------------- | ---------------------- |
| `NODE_ENV`                     | `development` | Environment mode       |
| `BUNDLE_ANALYZE`               | `false`       | Enable bundle analyzer |
| `BUNDLE_MINIFICATION`          | `true`        | Enable minification    |
| `BUNDLE_TREE_SHAKING`          | `true`        | Enable tree shaking    |
| `BUNDLE_SPLIT_CHUNKS`          | `true`        | Enable code splitting  |
| `BUNDLE_MAX_CHUNK_SIZE`        | `1000000`     | Max chunk size (1MB)   |
| `WEBPACK_MODULE_CONCATENATION` | `true`        | Enable scope hoisting  |
| `WEBPACK_SIDE_EFFECTS`         | `true`        | Respect sideEffects    |

### 2. Runtime Variables

Used when running the server:

#### Server Configuration

| Variable          | Default       | Description         |
| ----------------- | ------------- | ------------------- |
| `NODE_ENV`        | `development` | Environment mode    |
| `RSK_PORT`        | `3000`        | Server port         |
| `RSK_HOST`        | `localhost`   | Server host         |
| `RSK_HTTPS`       | `false`       | Enable HTTPS (dev)  |
| `RSK_TRUST_PROXY` | `loopback`    | Trust proxy setting |

#### API Configuration

| Variable            | Default | Description            |
| ------------------- | ------- | ---------------------- |
| `RSK_API_BASE_URL`  | `''`    | Browser API base URL   |
| `RSK_API_PROXY_URL` | `''`    | External API proxy URL |

#### Security

| Variable             | Default    | Description        |
| -------------------- | ---------- | ------------------ |
| `RSK_JWT_SECRET`     | _required_ | JWT signing secret |
| `RSK_JWT_EXPIRES_IN` | `7d`       | JWT expiration     |

#### Database

| Variable           | Default                  | Description         |
| ------------------ | ------------------------ | ------------------- |
| `RSK_DATABASE_URL` | `sqlite:database.sqlite` | Database connection |

#### i18n

| Variable         | Default | Description       |
| ---------------- | ------- | ----------------- |
| `RSK_I18N_DEBUG` | `false` | Enable i18n debug |

## RSK\_ Prefix

### Why RSK\_?

All application-specific variables use `RSK_` prefix for:

- **Namespace isolation** - Avoid conflicts with system vars
- **Security** - Only `RSK_` vars are injected into bundles
- **Clarity** - Easy to identify app-specific vars

### How It's Injected

```javascript
// tools/webpack/dotenvPlugin.webpack.js
export function createDotenvDefinitions({ prefix = 'RSK_' }) {
  const envVars = Object.keys(process.env)
    .filter(key => key.startsWith(prefix))
    .reduce((acc, key) => {
      acc[`process.env.${key}`] = JSON.stringify(process.env[key]);
      return acc;
    }, {});

  return envVars;
}
```

### Usage in Code

```javascript
// Available in both client and server code
const apiUrl = process.env.RSK_API_BASE_URL;
const jwtSecret = process.env.RSK_JWT_SECRET;
const isDebug = process.env.RSK_I18N_DEBUG === 'true';
```

## Development Setup

### 1. Copy Example File

```bash
cp .env.defaults .env
```

### 2. Edit Values

```bash
# .env
RSK_PORT=3000
RSK_HOST=localhost
RSK_JWT_SECRET=dev-secret-change-in-production
RSK_DATABASE_URL=sqlite:database.sqlite
```

### 3. Run

```bash
npm start  # Automatically loads .env
```

## Production Deployment

### ❌ DON'T

**Don't deploy .env file:**

```bash
# BAD - Don't do this!
rsync .env server:/app/
docker build --build-arg .env=.env .
```

**Why?**

- Security risk (secrets in file)
- Not portable (hardcoded values)
- Hard to update (need redeployment)

### ✅ DO

**Set environment variables on server:**

#### Traditional Server

```bash
# /etc/environment or ~/.bashrc
export NODE_ENV=production
export RSK_PORT=3000
export RSK_JWT_SECRET=prod-secret-xyz
export RSK_DATABASE_URL=postgresql://user:pass@db:5432/prod

# Run
node build/server.js
```

#### systemd Service

```ini
# /etc/systemd/system/my-app.service
[Service]
Environment="NODE_ENV=production"
Environment="RSK_PORT=3000"
Environment="RSK_JWT_SECRET=prod-secret"
EnvironmentFile=/etc/my-app/env
ExecStart=/usr/bin/node /app/build/server.js
```

#### PM2

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'my-app',
      script: 'build/server.js',
      env_production: {
        NODE_ENV: 'production',
        RSK_PORT: 3000,
        RSK_JWT_SECRET: process.env.JWT_SECRET,
      },
    },
  ],
};
```

#### Docker

**Dockerfile:**

```dockerfile
ENV NODE_ENV=production
ENV RSK_PORT=3000
```

**docker-compose.yml:**

```yaml
services:
  app:
    environment:
      - NODE_ENV=production
      - RSK_PORT=3000
      - RSK_JWT_SECRET=${JWT_SECRET}
    env_file:
      - .env.production # Optional
```

**Run command:**

```bash
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e RSK_PORT=3000 \
  -e RSK_JWT_SECRET=secret \
  my-app
```

#### Kubernetes

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  NODE_ENV: 'production'
  RSK_PORT: '3000'
---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
type: Opaque
stringData:
  RSK_JWT_SECRET: 'prod-secret'
---
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      containers:
        - name: app
          envFrom:
            - configMapRef:
                name: app-config
            - secretRef:
                name: app-secrets
```

## Security Best Practices

### 1. Never Commit Secrets

```bash
# .gitignore
.env
.env.local
.env.*.local
```

### 2. Use Different Secrets Per Environment

```bash
# Development
RSK_JWT_SECRET=dev-secret-123

# Production
RSK_JWT_SECRET=prod-secret-xyz-very-long-and-random
```

### 3. Rotate Secrets Regularly

```bash
# Update secret on server
export RSK_JWT_SECRET=new-secret

# Restart app
pm2 restart my-app
```

### 4. Use Secret Management

**AWS Secrets Manager:**

```bash
# Fetch secret at runtime
export RSK_JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id prod/jwt-secret \
  --query SecretString \
  --output text)
```

**HashiCorp Vault:**

```bash
# Fetch secret
export RSK_JWT_SECRET=$(vault kv get -field=value secret/jwt)
```

## Troubleshooting

### Variables Not Loading

**Problem:** Environment variables not available

**Check:**

```bash
# 1. Verify .env file exists
ls -la .env

# 2. Check dotenv is loaded
grep "dotenv" tools/tasks/build.js

# 3. Test variable
echo $RSK_PORT
```

### Variables Not Injected into Bundle

**Problem:** `process.env.RSK_*` is undefined

**Check:**

```bash
# 1. Verify RSK_ prefix
echo $RSK_API_URL  # ✅ Good
echo $API_URL      # ❌ Won't be injected

# 2. Check webpack config
grep "createDotenvDefinitions" tools/webpack/server.config.js

# 3. Rebuild
npm run build
```

### Production Variables Not Working

**Problem:** Variables work in dev but not production

**Solution:**

```bash
# Don't rely on .env in production
# Set variables directly:
export NODE_ENV=production
export RSK_PORT=3000

# Verify
env | grep RSK_
```

## Examples

### Complete .env File

```bash
# ==============================================================================
# Development Environment
# ==============================================================================

# Server
RSK_PORT=3000
RSK_HOST=localhost
RSK_HTTPS=false

# API
RSK_API_BASE_URL=
RSK_API_PROXY_URL=

# Security
RSK_JWT_SECRET=dev-secret-change-in-production
RSK_JWT_EXPIRES_IN=7d
RSK_TRUST_PROXY=loopback

# Database
RSK_DATABASE_URL=sqlite:database.sqlite

# i18n
RSK_I18N_DEBUG=false

# Build
BUNDLE_ANALYZE=false
BUNDLE_MINIFICATION=false
```

### Production Environment

```bash
# Set on server (no .env file)
export NODE_ENV=production
export RSK_PORT=3000
export RSK_HOST=0.0.0.0
export RSK_JWT_SECRET=prod-secret-very-long-and-random
export RSK_DATABASE_URL=postgresql://user:pass@db:5432/prod
export RSK_API_PROXY_URL=https://api.example.com
export RSK_API_BASE_URL=https://api.example.com
```

## Summary

### Development

- ✅ Use `.env` file
- ✅ Copy from `.env.defaults`
- ✅ Loaded automatically by `dotenv`

### Production

- ❌ Don't use `.env` file
- ✅ Set environment variables on server
- ✅ Use secret management tools

### All Environments

- ✅ Use `RSK_` prefix for app variables
- ✅ Never commit secrets to git
- ✅ Rotate secrets regularly

---

See [DEPLOYMENT.md](../DEPLOYMENT.md) for complete deployment guide.
