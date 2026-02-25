# Rapid RSK

Modern React SSR application with Express backend, Redux state management, and comprehensive tooling.

## Tech Stack

| Frontend        | Backend           | Build     |
| --------------- | ----------------- | --------- |
| React 18        | Express 4         | Webpack 5 |
| Redux Toolkit   | Sequelize 6       | Babel 7   |
| React Hook Form | SQLite/PostgreSQL | PostCSS   |

## Features

- ✨ **Server-Side Rendering (SSR)** - Fast initial page loads with React 18
- 🧩 **Plugin System** - Extensible architecture with hooks, slots, and registry
- 🔐 **Role-Based Access Control (RBAC)** - Comprehensive permissions, roles, and groups system
- 🔌 **WebSocket Support** - Real-time bidirectional communication
- 🎨 **Node-RED Integration** - Visual flow-based programming with Git-friendly flow management
- 📦 **Code Splitting** - Automatic route-based code splitting with Loadable Components
- 🔄 **Hot Module Replacement** - Fast development with instant updates
- 🧪 **Testing Ready** - Jest configured with React Testing Library
- 🎯 **Form Validation** - React Hook Form with Zod schema validation
- 📧 **Email Support** - Nodemailer integration for transactional emails
- ⏰ **Scheduled Tasks** - Node-cron for background jobs

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:1337](http://localhost:1337)

## Scripts

| Command          | Description                 |
| ---------------- | --------------------------- |
| `npm run dev`    | Development server with HMR |
| `npm run build`  | Production build            |
| `npm run test`   | Run tests                   |
| `npm run lint`   | Lint JS and CSS             |
| `npm run fix`    | Auto-fix linting issues     |
| `npm run format` | Format with Prettier        |

## Project Structure

```
src/
├── bootstrap/        # Application bootstrap & configuration
├── modules/          # Business logic & Views (auto-discovered)
│   ├── (default)/    # Default module (homepage, etc.)
│   │   ├── api/      # Backend logic (models, routes, etc.)
│   │   └── views/    # Frontend views
│   └── ...           # Other modules
├── shared/           # Shared utilities
│   ├── api/          # Core API infrastructure
│   │   ├── auth/     # Auth middlewares & cookies
│   │   ├── db/       # Database & Sequelize
│   │   └── ...       # cache, email, fs, http, queue, etc.
│   ├── jwt/          # JWT configuration & utilities
│   ├── renderer/     # SSR utilities and Redux store
│   ├── fetch/        # API client
│   ├── ws/           # WebSocket client
│   ├── i18n/         # i18n utilities
│   ├── validator/    # SSR validator utilities
│   └── node-red/     # Node-RED integration & migrations
├── client.js         # Client entry point
└── server.js         # Server entry point
tools/
├── tasks/            # Build tasks (build, clean, dev, etc.)
├── utils/            # Build utilities
├── jest/             # Jest configuration
├── webpack/          # Webpack configurations
```

## Environment Variables

Key variables in `.env`:

```bash
# Server Configuration
RSK_PORT=1337
RSK_HOST=127.0.0.1
RSK_HTTPS=false

# Application Metadata
RSK_APP_NAME="React Starter Kit"
RSK_APP_DESCRIPTION="Boilerplate for React.js web applications"

# API Gateway
RSK_API_BASE_URL=              # Leave empty for relative URLs
RSK_API_PROXY_URL=             # Optional external API proxy

# Database
RSK_DATABASE_URL=sqlite:database.sqlite
# PostgreSQL example: postgresql://user:password@localhost:5432/dbname

# Authentication
RSK_JWT_SECRET=your-secret-key  # Auto-generated on first run
RSK_JWT_EXPIRES_IN=7d

# Node-RED (Optional)
RSK_NODE_RED_URL=http://localhost:1880
```

See `.env.rsk` for all available options and detailed documentation.

## Production

```bash
# Build for production
npm run build

# Navigate to build directory
cd build

# Install production dependencies only
npm install --production

# Start production server
npm start
```

> **Note**: The JWT secret is auto-generated during the build process if not already set in `.env`.

### Docker

Build and run with Docker:

```bash
# Build image
docker build -t rapid-rsk .

# Run with environment variables
docker run -p 1337:1337 \
  -e NODE_ENV=production \
  -e RSK_JWT_SECRET=your-secure-secret \
  -e RSK_DATABASE_URL=postgresql://user:pass@host:5432/db \
  rapid-rsk

# Run with persistent database (SQLite)
docker run -p 1337:1337 \
  -v $(pwd)/data:/app/data \
  -e RSK_DATABASE_URL=sqlite:data/database.sqlite \
  rapid-rsk
```

For production deployments, consider:

- Using PostgreSQL instead of SQLite for better concurrency
- Setting up reverse proxy (nginx) for SSL/TLS termination
- Configuring proper logging and monitoring
- Using environment-specific `.env` files (never commit `.env` to git)

## Development

### API Architecture

The API is structured into **Shared API** and **Modules**:

**Shared API** (`src/shared/api/` & `src/shared/jwt/`):

- Core infrastructure components: `auth`, `cache`, `db`, `email`, `fs`, `http`, `queue`, `schedule`, `webhook`, `worker`, `jwt`
- Provide reusable capabilities for modules
- Should not contain business logic

**Modules** (`@apps/`):

- Business logic domains: `users`, `homepage`
- Consume shared API to implement features
- Auto-discovered and loaded at startup

**Key Pattern - Schedule + Worker + Queue:**

For heavy processing tasks, never run logic directly in scheduled callbacks. Instead:

1. **Schedule Engine** triggers the job
2. **Worker Pool** queues the request
3. **Worker Process** executes the heavy task

This pattern ensures:

- Non-blocking main process
- Controlled concurrency
- Automatic queueing
- Fault isolation

See [`.claude/commands/add-worker.md`](.claude/commands/add-worker.md) for detailed implementation.

### Module System

The application uses an auto-discovery module system. Place new modules in `@apps/`:

```
@apps/your-module/
├── api/               # Backend logic
│   ├── index.js       # Module entry point
│   ├── models/        # Sequelize models
│   ├── controllers/   # Route handlers
│   ├── services/      # Business logic
│   └── routes/        # Express routes
└── views/             # Frontend views
```

Modules are automatically discovered and loaded at startup by `src/bootstrap/index.js`.

### WebSocket Integration

WebSocket server runs alongside the Express server. Connect from client:

```javascript
import { createWebSocketClient } from '@/shared/ws';

const ws = createWebSocketClient();
ws.on('message', data => console.log(data));
```

### Node-RED Access

When Node-RED is enabled, access the visual editor at:

- Development: `http://localhost:1880`
- Production: Configure `RSK_NODE_RED_URL` in your environment

## License

MIT
