<div align="center">

# 🚀 xnapify

**Your API, SSR-ready in a Snap**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.txt)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16.14-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-61DAFB.svg)](https://reactjs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-000000.svg)](https://expressjs.com/)
[![Webpack](https://img.shields.io/badge/Webpack-5.96-8DD6F9.svg)](https://webpack.js.org/)

</div>

---

## ✨ Features

- **Server-Side Rendering** — Fast initial loads with SEO-friendly HTML, then seamless SPA hydration
- **Module Auto-Discovery** — Drop-in modules under `src/apps/` are automatically loaded (API + views)
- **RBAC** — Built-in users, roles, groups, and granular permissions with middleware guards
- **Extension System** — Extend functionality through UI Slots and logic Hooks without touching core code
- **Node-RED Integration** — Embedded visual workflow automation with versioned flow migrations
- **Background Workers** — Direct function calls for processing tasks (search indexing, checksum, file ops)
- **WebSocket** — Real-time communication with token-based authentication
- **Rich Editor** — [Tiptap 3](https://tiptap.dev/) WYSIWYG editor with collaboration support
- **i18n** — Internationalization powered by i18next
- **Developer Experience** — HMR, ESLint, Stylelint, Prettier, Jest, and benchmark tooling

## 📋 Prerequisites

| Tool    | Version   |
| ------- | --------- |
| Node.js | ≥ 16.14.0 |
| npm     | ≥ 8.0.0   |

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/xuanhoa88/xnapify.git
cd xnapify

# Install all dependencies (root + sub-packages)
npm run setup

# Start the development server (http://localhost:1337)
# .env is auto-created from .env.xnapify on first run
npm run dev
```

## 📁 Project Structure

```
xnapify/
├── src/                        # Application source code
│   ├── bootstrap/              # App bootstrap & configuration
│   ├── apps/                   # Business modules (auto-discovered)
│   │   ├── (default)/          # Default module (homepage)
│   │   ├── auth/               # Authentication
│   │   ├── users/              # User management
│   │   ├── roles/              # Role management
│   │   ├── groups/             # Group management
│   │   ├── permissions/        # Permission management
│   │   ├── files/              # File management
│   │   ├── emails/             # Email management
│   │   ├── search/             # Search engine
│   │   ├── webhooks/           # Webhook management
│   │   ├── activities/         # Activity logging
│   │   └── extensions/         # Extension management
│   ├── extensions/                # Application extensions
│   ├── client.js               # Client entry point
│   └── server.js               # Server entry point
├── shared/                     # Shared libraries (@shared alias)
│   ├── api/                    # Core API infrastructure
│   │   ├── engines/            # Auto-loaded engine modules
│   │   │   ├── auth/           # Auth middlewares & cookies
│   │   │   ├── cache/          # Caching layer (LRU)
│   │   │   ├── db/             # Database & Sequelize ORM
│   │   │   ├── email/          # Email service (Nodemailer)
│   │   │   ├── fs/             # Filesystem operations
│   │   │   ├── hook/           # Hook engine (event channels)
│   │   │   ├── http/           # HTTP client utilities
│   │   │   ├── queue/          # Job queue
│   │   │   ├── schedule/       # Cron scheduling
│   │   │   ├── search/         # Full-text search
│   │   │   ├── template/       # Template engine (LiquidJS)
│   │   │   └── webhook/        # Webhook engine
│   │   ├── autoloader.js       # Module auto-discovery
│   │   └── index.js            # Re-exports all engines
│   ├── container/              # Dependency injection container
│   ├── renderer/               # SSR utilities & Redux store
│   ├── fetch/                  # Universal API client
│   ├── ws/                     # WebSocket client
│   ├── jwt/                    # JWT utilities
│   ├── i18n/                   # Internationalization
│   ├── extension/              # Extension system (registry, slots, hooks)
│   ├── validator/              # Validation (Zod)
│   ├── node-red/               # Node-RED integration & migrations
│   └── utils/                  # Common utilities
├── tools/                      # Build tooling
│   ├── webpack/                # Webpack configs (client, server)
│   ├── jest/                   # Jest configuration
│   └── tasks/                  # Build tasks (dev, build, test, etc.)
├── public/                     # Static assets
├── Dockerfile                  # Multi-stage production Docker build
├── .env.xnapify                # Environment variable template
└── package.json
```

## 🛠️ Tech Stack

### Frontend

| Technology            | Purpose                    |
| --------------------- | -------------------------- |
| React 18              | UI with SSR and hydration  |
| Redux Toolkit         | Global state management    |
| React Hook Form + Zod | Form handling & validation |
| Tiptap 3              | Rich text editor (WYSIWYG) |
| CSS Modules + PostCSS | Scoped styling             |
| i18next               | Internationalization       |

### Backend

| Technology      | Purpose                                     |
| --------------- | ------------------------------------------- |
| Express 4       | HTTP server                                 |
| Sequelize 6     | ORM (PostgreSQL, MySQL, SQLite)             |
| JSON Web Tokens | Authentication                              |
| Passport.js     | OAuth (Google, Facebook, GitHub, Microsoft) |
| ws              | WebSocket server                            |
| Nodemailer      | Email delivery                              |
| node-cron       | Scheduled tasks                             |
| Node-RED        | Visual workflow automation                  |

### Tooling

| Technology                    | Purpose                       |
| ----------------------------- | ----------------------------- |
| Webpack 5                     | Bundling, code splitting, HMR |
| Babel 7                       | ES2015+ transpilation         |
| Jest                          | Testing & benchmarks          |
| ESLint + Prettier + Stylelint | Code quality & formatting     |

## 📜 Available Scripts

```bash
# Setup
npm run setup                  # Install all dependencies (root + sub-packages)

# Development
npm run dev                    # Start dev server with HMR
npm run build                  # Build for production
npm run clean                  # Clean build artifacts

# Testing
npm run test                   # Run all tests
npm run test:watch             # Watch mode
npm run test:coverage          # Coverage report
npm run test:ci                # CI mode
npm run test:benchmark         # Run performance benchmarks

# Code Quality
npm run lint                   # Lint JS + CSS
npm run fix                    # Auto-fix lint issues
npm run format                 # Format with Prettier
npm run format:check           # Check formatting
```

## 🏗️ Architecture Overview

### Module System

Each module lives under `src/apps/<module-name>/` and is automatically discovered:

```
src/apps/<module>/
├── api/                  # Backend
│   ├── index.js          # Module entry — exports routes(), models(), init()
│   ├── routes/           # Express route definitions
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic
│   └── models/           # Sequelize model definitions
└── views/                # Frontend (pages, components, Redux slices)
    └── (admin)/          # Admin panel views
        └── _route.js     # Page route with lifecycle hooks
```

### Route Lifecycle Hooks

Each `_route.js` page can export lifecycle hooks:

| Hook              | When Called      | Purpose                      |
| ----------------- | ---------------- | ---------------------------- |
| `register`        | Route discovered | Register menus, global state |
| `middleware`      | Before render    | Permission checks            |
| `mount`           | Route mounted    | Set breadcrumbs              |
| `getInitialProps` | Before render    | Data fetching, page metadata |
| `unregister`      | Route unloaded   | Cleanup                      |

> **Note:** Redux reducer injection is handled in `views/index.js` `providers()` hook, not in `_route.js`.

### Extension System

Extend the application without modifying core code:

```javascript
// Define an extension (src/extensions/my-plugin/views/index.js)
export default {
  boot({ registry }) {
    registry.registerSlot('profile.actions', MyButton, { order: 10 });
    registry.registerHook('user.validate', myValidator);
  },
  shutdown({ registry }) {
    registry.unregisterSlot('profile.actions', MyButton);
    registry.unregisterHook('user.validate', myValidator);
  },
};

// Render a slot in JSX
<ExtensionSlot name='profile.actions' props={userData} />;
```

### Authentication & RBAC

- **JWT** in HTTP-only cookies for stateless auth
- **Middleware guards**: `requireAuth`, `requirePermission`, `requireRole`, `requireGroup`, `requireOwnership`, `optionalAuth`
- **OAuth**: Google, Facebook, GitHub, Microsoft via Passport.js

## ⚙️ Configuration

All environment variables use the `XNAPIFY_` prefix. Copy `.env.xnapify` to `.env` and configure:

```bash
# Server
XNAPIFY_PORT=1337
XNAPIFY_HOST=127.0.0.1

# Application
XNAPIFY_PUBLIC_APP_NAME="xnapify"
XNAPIFY_PUBLIC_APP_DESC="Snap your API, Stream your React"

# Database (drivers installed on-demand by preboot.js)
# Use shorthand 'sqlite', 'postgres', 'mysql' or full URL
XNAPIFY_DB_URL=sqlite:database.sqlite

# Authentication
XNAPIFY_KEY=            # Auto-generated on first run
XNAPIFY_JWT_EXPIRY=7d
```

> **Note:** Environment variables are baked into the client bundle at build time. Changing them requires a rebuild.

### 🗄️ Database

**Default:** SQLite (zero-config). Drivers are installed on-demand — no DB packages in `package.json`.

**Switch databases:** Set `XNAPIFY_DB_URL` in `.env`, then `npm run dev`:
- `XNAPIFY_DB_URL=postgres` — PostgreSQL (embedded auto-download on port 5433)
- `XNAPIFY_DB_URL=mysql` — MySQL 8.4 LTS (embedded auto-download on port 3307)
- Full URLs also supported (e.g., `postgresql://user:pass@host:5432/db`)

**On-demand override** (does NOT modify `.env` — uses session-scoped `.env.local`):

```bash
XNAPIFY_DB=mysql npm run dev        # Dev with MySQL (one-shot)
XNAPIFY_DB=postgres npm run dev     # Dev with PostgreSQL (one-shot)
XNAPIFY_DB=mysql npm start          # Production with MySQL (one-shot)
```

Preboot resolves servers with a 3-tier priority chain:
1. **Configured URL** — if reachable, use it
2. **Local system server** — auto-detect PG (5432) or MySQL (3306)
3. **Embedded server** — auto-download + start portable daemon

```bash
# Manual control (auto-detects dialect from XNAPIFY_DB_URL)
node tools/npm/preboot.js --status                # Show DB status
node tools/npm/preboot.js --start                 # Start embedded DB
node tools/npm/preboot.js --stop                  # Stop embedded DB

# Override dialect
node tools/npm/preboot.js --db mysql --start      # Force MySQL
node tools/npm/preboot.js --db postgres --stop    # Force PostgreSQL
```

## 🐳 Docker

```bash
# Build image
docker build -t xnapify .

# Run container (SQLite default)
docker run -p 1337:1337 \
  -e NODE_ENV=production \
  -e XNAPIFY_KEY=$(openssl rand -base64 32) \
  xnapify

# With PostgreSQL
docker run -p 1337:1337 \
  -e NODE_ENV=production \
  -e XNAPIFY_KEY=$(openssl rand -base64 32) \
  -e XNAPIFY_DB_URL=postgresql://user:pass@host:5432/dbname \
  xnapify

# With MySQL
docker run -p 1337:1337 \
  -e NODE_ENV=production \
  -e XNAPIFY_KEY=$(openssl rand -base64 32) \
  -e XNAPIFY_DB_URL=mysql://user:pass@host:3306/dbname \
  xnapify
```

## 🚢 Production Deployment

```bash
# Install all dependencies
npm run setup

# Build
npm run build

# Deploy (inside the build output directory)
cd build
npm run setup              # ← only for build/, NOT project root (.npmrc forces production=true)
npm start                  # .env + DB driver auto-provisioned on first start
```

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute, including commit conventions and PR requirements.

## 📄 License

This project is licensed under the [MIT License](LICENSE.txt).
