# Configuration

This guide explains how to configure the React Starter Kit for different environments and use cases.

## 🔧 Environment Variables

The application is configured using environment variables with the `RSK_` prefix (React Starter Kit).

### Setup

1. Copy the example environment file:

```bash
cp .env.defaults .env
```

2. Edit `.env` with your values
3. Restart the development server

### Available Variables

## Server Configuration

### `RSK_PORT`

- **Default:** `3000`
- **Description:** Port number for the application server
- **Example:** `RSK_PORT=8080`

### `RSK_HOST`

- **Default:** `localhost`
- **Description:** Host for the development server
- **Example:** `RSK_HOST=0.0.0.0` (for Docker)

### `RSK_HTTPS`

- **Default:** `false`
- **Description:** Enable HTTPS for development server
- **Example:** `RSK_HTTPS=true`

## API Configuration

### `RSK_API_BASE_URL`

- **Default:** `` (empty - uses relative URLs)
- **Description:** Base URL for browser API requests
- **Example:** `RSK_API_BASE_URL=https://api.example.com`
- **Use Case:** When API is on a different domain than the web server

### `RSK_API_PROXY_URL`

- **Default:** `` (empty - no external proxy)
- **Description:** External API URL to proxy `/api/*` requests to
- **Example:** `RSK_API_PROXY_URL=https://api.github.com`
- **Use Case:** Proxy client requests to external API, hide API keys, avoid CORS

**How it works:**

```
Client request: /api/users
↓
Local API routes checked first
↓ (if no match)
Proxied to: https://api.github.com/users
```

## Database Configuration

### `RSK_DATABASE_URL`

- **Default:** `sqlite:database.sqlite`
- **Description:** Database connection URL
- **Examples:**
  - SQLite: `sqlite:database.sqlite`
  - PostgreSQL: `postgresql://user:password@localhost:5432/dbname`
  - MySQL: `mysql://user:password@localhost:3306/dbname`

## Authentication Configuration

### `RSK_JWT_SECRET`

- **Default:** `your-secret-key-change-this`
- **Description:** Secret key for signing JWT tokens
- **⚠️ IMPORTANT:** Change this in production!
- **Example:** `RSK_JWT_SECRET=$(openssl rand -base64 32)`

### `RSK_JWT_EXPIRES_IN`

- **Default:** `1d`
- **Description:** JWT token expiration time
- **Examples:**
  - `60` - 60 seconds
  - `2h` - 2 hours
  - `7d` - 7 days
  - `30d` - 30 days

## Build-Time Configuration (RSK\_ Variables)

Variables with `RSK_` prefix can be injected into the server bundle at build time for feature flags and non-sensitive configuration.

### Feature Flags

```bash
# Enable/disable features
RSK_FEATURE_NEW_DASHBOARD=true
RSK_FEATURE_BETA_API=false
```

Usage in code:

```javascript
if (process.env.RSK_FEATURE_NEW_DASHBOARD === 'true') {
  app.use('/dashboard', newDashboardRouter);
}
```

### Build Information

```bash
RSK_APP_VERSION=1.2.3
RSK_BUILD_NUMBER=456
RSK_COMMIT_SHA=abc123
```

### Configuration Limits

```bash
RSK_MAX_UPLOAD_SIZE=10485760  # 10MB
RSK_RATE_LIMIT_REQUESTS=100
```

### ⚠️ Security Warning

**DO NOT** use `RSK_` prefix for sensitive data:

- ❌ `RSK_JWT_SECRET` - Use `JWT_SECRET` instead
- ❌ `RSK_DATABASE_PASSWORD` - Use regular env vars
- ✅ `RSK_FEATURE_FLAG` - OK for feature flags
- ✅ `RSK_PUBLIC_API_URL` - OK for public URLs

**Why?** RSK\_ variables are baked into the server bundle and could be extracted. Keep secrets in regular environment variables.

## Development Configuration

### `LOG_LEVEL`

- **Default:** `info`
- **Options:** `silent`, `info`, `verbose`, `debug`
- **Description:** Logging verbosity
- **Example:** `LOG_LEVEL=verbose npm start`

### `BROWSER`

- **Default:** `default`
- **Description:** Browser to open for development
- **Example:** `BROWSER=chrome npm start`

### `WEBPACK_ANALYZE`

- **Default:** `false`
- **Description:** Enable webpack bundle analyzer
- **Example:** `WEBPACK_ANALYZE=true npm run build`

## Testing Configuration

### `CI`

- **Default:** `false`
- **Description:** Enable CI-specific settings
- **Example:** `CI=true npm test`

### `COVERAGE`

- **Default:** `false`
- **Description:** Enable code coverage collection
- **Example:** `COVERAGE=true npm test`

### `JEST_VERBOSE`

- **Default:** `true`
- **Description:** Verbose test output
- **Example:** `JEST_VERBOSE=false npm test`

## Environment-Specific Configuration

### Development (`.env`)

```bash
# Development settings
RSK_PORT=3000
RSK_HOST=localhost
RSK_HTTPS=false

# Use local SQLite database
RSK_DATABASE_URL=sqlite:database.sqlite

# Development JWT secret (change in production!)
RSK_JWT_SECRET=dev-secret-change-in-production
RSK_JWT_EXPIRES_IN=7d

# Enable verbose logging
LOG_LEVEL=verbose
```

### Production (`.env.production`)

```bash
# Production settings
RSK_PORT=8080
RSK_HOST=0.0.0.0

# Production database
RSK_DATABASE_URL=postgresql://user:pass@db.example.com:5432/prod

# Strong JWT secret
RSK_JWT_SECRET=${STRONG_RANDOM_SECRET}
RSK_JWT_EXPIRES_IN=1d

# External API
RSK_API_PROXY_URL=https://api.example.com

# Minimal logging
LOG_LEVEL=info
```

### Docker (`.env.docker`)

```bash
# Docker settings
RSK_PORT=3000
RSK_HOST=0.0.0.0

# Docker database
RSK_DATABASE_URL=postgresql://postgres:postgres@db:5432/app

# Environment from secrets
RSK_JWT_SECRET=${JWT_SECRET}
```

## Configuration Files

### Babel (`.babelrc.js`)

Configure JavaScript transpilation:

```javascript
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    '@babel/preset-react',
  ],
  plugins: [
    '@babel/plugin-transform-class-properties',
    // Add more plugins...
  ],
};
```

### ESLint (`.eslintrc.js`)

Configure code linting:

```javascript
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  rules: {
    // Custom rules...
  },
};
```

### Prettier (`.prettierrc.js`)

Configure code formatting:

```javascript
module.exports = {
  printWidth: 80,
  singleQuote: true,
  trailingComma: 'all',
  // More options...
};
```

### PostCSS (`tools/postcss.config.js`)

Configure CSS processing:

```javascript
module.exports = {
  plugins: [
    require('autoprefixer'),
    // Add more plugins...
  ],
};
```

### Jest (`jest.config.js`)

Configure testing:

```javascript
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  collectCoverageFrom: ['src/**/*.js'],
  // More options...
};
```

## Webpack Configuration

Located in `tools/webpack/`:

- **`webpack.config.js`** - Main configuration
- **`client.js`** - Client bundle config
- **`server.js`** - Server bundle config

### Custom Webpack Config

Edit `tools/webpack/webpack.config.js`:

```javascript
module.exports = {
  // Add custom loaders
  module: {
    rules: [
      // Your custom rules...
    ],
  },

  // Add custom plugins
  plugins: [
    // Your custom plugins...
  ],
};
```

## Build Configuration

Located in `tools/config.js`:

```javascript
module.exports = {
  // Build settings
  verbose: process.env.LOG_LEVEL === 'verbose',
  analyze: process.env.WEBPACK_ANALYZE === 'true',

  // Paths
  buildDir: 'build',
  publicDir: 'public',

  // Performance
  renderTimeout: 30000,
  renderParallel: 5,
};
```

## Database Configuration

### SQLite (Development)

```bash
RSK_DATABASE_URL=sqlite:database.sqlite
```

### PostgreSQL (Production)

```bash
RSK_DATABASE_URL=postgresql://user:password@host:5432/database
```

### MySQL

```bash
RSK_DATABASE_URL=mysql://user:password@host:3306/database
```

### Connection Options

Add options to the connection URL:

```bash
# PostgreSQL with SSL
RSK_DATABASE_URL=postgresql://user:pass@host:5432/db?ssl=true

# MySQL with timezone
RSK_DATABASE_URL=mysql://user:pass@host:3306/db?timezone=UTC
```

## Best Practices

### Security

1. **Never commit `.env`** - Add to `.gitignore`
2. **Use strong secrets** - Generate with `openssl rand -base64 32`
3. **Rotate secrets regularly** - Change JWT secrets periodically
4. **Use environment-specific configs** - Different values for dev/prod
5. **Keep secrets out of RSK\_ variables** - Use regular env vars for sensitive data

### Organization

1. **Use `.env.defaults`** - Document all required variables
2. **Group related variables** - Server, API, Database, etc.
3. **Add comments** - Explain what each variable does
4. **Provide defaults** - Fallback values in code

### Deployment

1. **Use platform secrets** - Heroku Config Vars, AWS Secrets Manager, etc.
2. **Validate on startup** - Check required variables exist
3. **Log configuration** - Show active config (without secrets)
4. **Use different files** - `.env.development`, `.env.production`

## Troubleshooting

### Variables Not Loading

```bash
# Check .env file exists
ls -la .env

# Check dotenv is loaded
# Should be in tools/run.js
require('dotenv').config({ override: true });
```

### Wrong Values

```bash
# Check for typos in variable names
# Must start with RSK_ for app-specific vars

# Check for spaces around =
# ❌ RSK_PORT = 3000
# ✅ RSK_PORT=3000
```

### Build-Time vs Runtime

- **Runtime variables** - Read when server starts (JWT_SECRET, DATABASE_URL)
- **Build-time variables** - Baked into bundle (RSK_FEATURE_FLAG)
- Changing build-time variables requires rebuild

## Next Steps

- **[Getting Started](getting-started.md)** - Set up your environment
- **[Development Workflow](development.md)** - Start developing
- **[Deployment](deployment.md)** - Deploy to production
- **[Security](security.md)** - Security best practices
