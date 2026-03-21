# React Starter Kit - AI Assistant Guide

## Project Overview

**Rapid RSK** is a production-ready, full-stack React application with server-side rendering (SSR), built on React 18, Express 4, and Webpack 5. This is a **single-repository** application with comprehensive tooling, RBAC, WebSocket support, and Node-RED integration for modern web development.

## Project Structure

```
react-starter-kit/
├── src/                          # Application source code
│   ├── bootstrap/                # Application bootstrap & configuration
│   ├── apps/                     # Business modules (auto-discovered)
│   │   ├── (default)/            # Default module (homepage, etc.)
│   │   │   ├── api/              # Backend: routes, controllers, models, services
│   │   │   └── views/            # Frontend: React pages, Redux slices
│   │   └── {module}/             # Other modules (users, roles, etc.)
│   ├── extensions/                  # Extension packages (auto-discovered)
│   ├── client.js                 # Client entry point
│   └── server.js                 # Server entry point
├── shared/                       # Shared libraries (aliased as @shared)
│   ├── api/                      # Core API infrastructure
│   │   ├── engines/              # Auto-loaded engines
│   │   │   ├── auth/             # Auth middlewares & cookies
│   │   │   ├── cache/            # LRU caching
│   │   │   ├── db/               # Sequelize ORM & migrations
│   │   │   ├── hook/             # Channel-based event system
│   │   │   ├── schedule/         # Cron scheduling
│   │   │   ├── webhook/          # Webhook engine
│   │   │   ├── worker/           # Piscina worker pools
│   │   │   └── ...               # email, fs, http, queue, search, template
│   │   ├── router/               # File-based API routing engine
│   │   └── index.js              # Engine auto-loader
│   ├── container/                # Dependency injection container
│   ├── extension/                   # Extension registry (slots & hooks)
│   ├── jwt/                      # JWT configuration & utilities
│   ├── renderer/                 # SSR utilities and Redux store
│   ├── fetch/                    # API client
│   ├── ws/                       # WebSocket client
│   ├── i18n/                     # i18n utilities
│   ├── validator/                # Zod validation wrapper
│   ├── utils/                    # General utilities
│   └── node-red/                 # Node-RED integration & migrations
├── tools/                        # Build tools and tasks
│   ├── tasks/                    # Build tasks (build, dev, clean, test, etc.)
│   ├── utils/                    # Build utilities (fs, logger, etc.)
│   ├── jest/                     # Jest configuration
│   ├── webpack/                  # Webpack configurations
│   └── run.js                    # Task runner
├── build/                        # Production build output
├── public/                       # Static assets
├── .agent/                       # AI assistant configuration
│   ├── rules.md                  # Coding rules & constraints
│   ├── workflows/                # Step-by-step development guides (23)
│   ├── skills/                   # AI persona skills (12)
│   └── templates/                # SPEC.md template
├── database.sqlite               # Local SQLite database (dev)
└── .env.rsk                      # Environment variable template
```

## Tech Stack

### Core

- **Runtime:** Node.js >= 16.14.0
- **Package Manager:** npm >= 8.0.0
- **Language:** JavaScript (ES2015+) with JSX

### Frontend

- **React:** 18.3.1 with SSR and hydration
- **State Management:** Redux 5.0.1 + Redux Toolkit 2.11.1
- **Routing:** Custom page auto-discovery with dynamic imports
- **Styling:** CSS Modules + PostCSS
- **Forms:** React Hook Form 7.51.5 + Zod 3.23.8 validation
- **i18n:** i18next 23.15.2 + react-i18next 14.1.3

### Backend

- **Server:** Express 4.21.2
- **Authentication:** JWT (jsonwebtoken 9.0.2 + express-jwt 8.4.1)
- **Database:** Sequelize 6.37.7 ORM (PostgreSQL, MySQL, SQLite)
- **WebSocket:** ws 8.18.3
- **Email:** Nodemailer 7.0.12
- **Scheduling:** node-cron 4.2.1
- **Middleware:** compression, cookie-parser, cors, express-rate-limit

### Build Tools

- **Bundler:** Webpack 5.96.0 with code splitting and tree shaking
- **Transpiler:** Babel 7.28.5 with preset-env and preset-react
- **CSS Processing:** PostCSS with autoprefixer and CSS Modules
- **HMR:** React Refresh + webpack-hot-middleware

### Code Quality

- **Linting:** ESLint 8.57.0 with @babel/eslint-parser
- **CSS Linting:** Stylelint 14.16.1
- **Formatting:** Prettier 3.3.3
- **Testing:** Jest 24.9.0 with React Testing Library

### DevOps

- **Docker:** Production-ready Dockerfile
- **Process Management:** Graceful shutdown handlers
- **Logging:** Console-based logging with environment awareness

## Essential Commands

```bash
# Development
npm run dev                    # Start dev server with HMR (http://localhost:1337)
npm run build                  # Build for production
npm run clean                  # Clean build directory

# Testing
npm run test                   # Run all tests
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Run tests with coverage
npm run test:ci                # Run tests in CI mode

# Code Quality
npm run lint                   # Lint all code (JS + CSS)
npm run lint:js                # Lint JavaScript files
npm run lint:css               # Lint CSS files
npm run fix                    # Auto-fix all issues
npm run fix:js                 # Auto-fix JavaScript issues
npm run fix:css                # Auto-fix CSS issues
npm run format                 # Format code with Prettier
npm run format:check           # Check code formatting
```

## Architecture Patterns

### 1. Module Auto-Discovery

The application uses an auto-discovery system for both API modules and page components.

**API Modules** (`src/bootstrap/index.js`):

- Automatically discovers modules in `@apps/*/api/index.js`
- Each module can export models, routes, and initialization logic
- Modules are loaded in two phases: models first, then routes

**Views** (`src/bootstrap/views.js`):

- Automatically discovers views in `@apps/*/views`
- Finds and mounts `_route.js` files using a defined hierarchy
- Merges metadata and props via `getInitialProps`

### 2. Shared API vs Modules

**Shared API** (`shared/api/engines/` & `shared/jwt/`):

- Core infrastructure: `auth`, `cache`, `db`, `email`, `fs`, `hook`, `http`, `queue`, `schedule`, `search`, `template`, `webhook`, `worker`
- Auto-loaded from `shared/api/engines/*/index.js` and re-exported via `shared/api/index.js`
- Provide reusable capabilities for modules — should not contain business logic

**Modules** (`@apps/`):

- Business domains: `users`, `roles`, `groups`, `permissions`, `files`, `emails`, etc.
- Consume shared API to implement features
- Structure: `api/` (backend) and `views/` (frontend)

### 3. Universal Rendering (SSR)

- Server renders initial HTML for fast page loads and SEO
- Client hydrates and takes over for SPA experience
- Shared code between client and server
- Redux state is serialized and transferred from server to client

### 4. State Management

- **Redux Toolkit** for global state management
- **Global Features:** `runtime`, `user`, `ui`, `intl` (in `shared/renderer/redux/features/`)
- **Module-level Features:** Colocated in `views/{view-path}/redux/` with dynamic injection
- **Store Configuration:** `shared/renderer/redux/configureStore.js`
- **Middleware:** Redux Logger (dev only), custom middleware for async actions
- **Helpers:** Store receives `fetch`, `history`, `i18n` as extra arguments
- **Dynamic Injection:** Use `store.injectReducer(SLICE_NAME, reducer)` in module `views/index.js` `providers()` hook

### 5. Authentication & Authorization

- **JWT-based authentication** with HTTP-only cookies
- **RBAC system:** Users, Roles, Groups, Permissions
- **Middleware:** `shared/api/engines/auth/middlewares/` (`requireAuth`, `requirePermission`, `requireRole`, `requireGroup`, `requireOwnership`, `optionalAuth`)
- **Protected routes:** Use `requireAuth` and `requirePermission` middlewares
- **API endpoints:** `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/register`

### 6. WebSocket Integration

- WebSocket server runs alongside Express server
- Token-based authentication for WebSocket connections
- Client connects via `shared/ws/`
- Server implementation in `src/server.js` (`initWebSocket`)

### 7. Extension System

The application features a robust extension system (`shared/extension`) for extending functionality without modifying core code.

**Core Concepts:**

- **Registry:** Singleton managing all extensions, slots, and hooks.
- **Slots:** UI extension points where extensions can render components.
- **Hooks:** Logic extension points for modifying data or schema.

**Using Extensions:**

```javascript
// Register an extension
import { registry } from '@shared/extension/client';

registry.register('my-extension', {
  init: async (reg, context) => {
    // Register UI slot
    reg.registerSlot('profile.actions', MyButton, { order: 10 });

    // Register Logic hook
    reg.registerHook('user.validate', myValidator);
  },
});

// Render a Slot (in your component)
import { ExtensionSlot } from '@shared/extension/client';

<ExtensionSlot name='profile.actions' props={userData} />;

// Execute Hooks (in your logic)
import { useExtensionHooks } from '@shared/extension/client';

const hooks = useExtensionHooks();
const results = await hooks.execute('user.validate', userData);
```

### 8. Node-RED Integration

The application embeds Node-RED (`shared/node-red`) for visual workflow automation, fully integrated with the app's authentication and deployment lifecycle.

**Key Features:**

- **Embedded Architecture:** Runs as middleware within the Express app, sharing the same port and server instance.
- **Unified Authentication:** Uses the application's RBAC system. Users need `nodered:read` or `nodered:admin` permissions to access the editor.
- **Flow Splitter Extension:** Automatically splits the monolithic `flows.json` and creates versioned snapshots in `shared/node-red/migrations/`.
  - **Development:** Edits in the UI are split and saved as a new migration timestamp on deploy.
  - **Production:** Rebuilds `flows.json` from the latest migration snapshot on startup.

**Configuration:**

Controlled via `shared/node-red/settings.js` and environment variables.

- **Dev:** Verbose logging, diagnostic endpoints enabled.
- **Prod:** Minimal logging, metrics enabled, admin endpoints secured.

### 9. Worker Pattern

For heavy processing, use the Worker Engine:

```javascript
// 1. Define worker handler
const myTaskLogic = async payload => {
  // Heavy processing
  return { success: true };
};

// Export as a named function matching the messageType
export { myTaskLogic as MY_TASK_TYPE };

// 2. Create worker pool
import { createWorkerPool } from '@shared/api/worker';

const workersContext = require.context('.', false, /\.worker\.js$/);
const workerPool = createWorkerPool('MyDomain', workersContext, {
  maxWorkers: 2, // Concurrency limit
  // Optional: forceFork: true (to skip same-process execution)
});

// 3. Dispatch jobs
try {
  const result = await workerPool.sendRequest('task-name', 'MY_TASK_TYPE', payload, {
    throwOnError: true, // Native robust error propagation
  });
  console.log('Worker result:', result);
} catch (error) {
  console.error('Worker failed natively:', error);
}
```

### 10. Engine Auto-Loader

All shared infrastructure lives in `shared/api/engines/`. Engines are **auto-discovered** from `engines/*/index.js` and re-exported as named exports from `shared/api/index.js`.

**Access patterns:**

```javascript
// 1. Direct import (shared code, top-level modules)
import { db, auth, hook, cache } from '@shared/api';

// 2. Via DI container in module init (preferred in modules)
// In init(container):
const hook = container.resolve('hook');
const db = container.resolve('db');

// In route handlers / controllers:
const container = req.app.get('container');
const { models } = container.resolve('db');
```

> **Convention:** In module code (`init`, services), use `container.resolve('name')` directly. In route handlers/controllers, use `req.app.get('container').resolve('name')`. Direct imports are reserved for shared libraries.

**Available Engines:** `auth`, `cache`, `db`, `email`, `fs`, `hook`, `http`, `queue`, `schedule`, `search`, `template`, `webhook`, `worker`

**Adding a New Engine:**

1. Create `shared/api/engines/{name}/index.js`
2. Export a default or named exports
3. It's automatically available via `container.resolve('{name}')`

### 11. Hook Engine

Channel-based async event system (`shared/api/engines/hook`) for decoupled inter-module communication.

```javascript
// In init(container) or controllers:
const hook = container.resolve('hook');  // or req.app.get('container').resolve('hook')

// Create/get a channel
const userHooks = hook('users');

// Register handlers with optional priority (lower = first)
userHooks.on('create', async (user) => {
  user.createdAt = new Date();
}, 10);

// Emit events — handlers run sequentially, can mutate data
await userHooks.emit('create', userData);

// Management
hook.has('users');          // Check if channel exists
hook.getChannelNames();     // List all channels
hook.remove('users');       // Remove a channel
hook.cleanup();             // Clear all
```

### 12. Dependency Injection Container

Lightweight DI container (`shared/container`) for sharing services across modules.

```javascript
import container from '@shared/container';

// Factory binding (new instance per resolve)
container.bind('key', () => createInstance());

// Singleton binding (cached after first resolve)
container.singleton('db:pool', () => createPool());

// Instance binding (store pre-built value)
container.instance('config', { debug: true });

// Resolve
const pool = container.resolve('db:pool');

// Inspection & cleanup
container.has('key');              // Check existence
container.getBindingNames();       // List all bindings
container.reset('key');            // Remove one
container.cleanup();               // Remove all
```

**Convention:** Use `module:scope` naming (e.g., `users:controllers`, `billing:services`).

### 13. File-Based API Routing

API routes are auto-resolved from the filesystem (`shared/api/router`). Directory names become URL segments.

**Path Mapping Rules:**

| File Path | URL |
|---|---|
| `routes/(default)/_route.js` | `/api/{module}` |
| `routes/(admin)/(default)/_route.js` | `/api/{module}` (admin group) |
| `routes/(admin)/[id]/_route.js` | `/api/{module}/:id` |
| `routes/status/_route.js` | `/api/{module}/status` |

**Method Exports:**

```javascript
// _route.js — export HTTP verbs as named exports
export function get(req, res) { /* GET */ }
export function post(req, res) { /* POST */ }
export const put = [middleware, handler];  // Array = middleware chain
export const del = [middleware, handler];  // del = DELETE
export { del as delete };
```

**Route Middlewares (`_middleware.js`):**

```javascript
// _middleware.js — applies to directory and all children
export default [rateLimiter, requireAuth];
```

**Opting Out of Parent Middleware:**

```javascript
// In _route.js — bypass inherited middlewares
export const middleware = false;  // No parent middlewares
```

## Code Conventions

### 1. Component Patterns

```javascript
// Functional components with hooks
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useSelector, useDispatch } from 'react-redux';

function MyComponent({ title }) {
  const dispatch = useDispatch();
  const user = useSelector(state => state.user);
  const [data, setData] = useState(null);

  useEffect(() => {
    // Side effects
  }, []);

  return (
    <div>
      {title}: {data?.value}
    </div>
  );
}

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
};

export default MyComponent;
```

### 2. Redux Toolkit Patterns

```javascript
// Module-level slice (@apps/blog/views/(admin)/posts/redux/slice.js)
import { createSlice } from '@reduxjs/toolkit';
import { fetchPosts, createPost } from './thunks';

export const SLICE_NAME = '@admin/posts';

const postsSlice = createSlice({
  name: SLICE_NAME,
  initialState: { items: [], loading: false, error: null },
  reducers: {
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchPosts.pending, state => {
        state.loading = true;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.items = action.payload;
        state.loading = false;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.error = action.payload;
        state.loading = false;
      });
  },
});

export const { clearError } = postsSlice.actions;
export default postsSlice.reducer;

// Thunks (@apps/blog/views/(admin)/redux/thunks.js)
import { createAsyncThunk } from '@reduxjs/toolkit';

export const fetchPosts = createAsyncThunk(
  'admin/posts/fetchPosts',
  async (options = {}, { extra: { fetch }, rejectWithValue }) => {
    try {
      const { data } = await fetch('/api/posts', { query: options });
      return data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  },
);
```

### 3. Styling with CSS Modules

```javascript
import React from 'react';
import s from './MyComponent.module.css';

function MyComponent() {
  return <div className={s.container}>Content</div>;
}
```

### 4. Page Routing with Lifecycle Hooks

```javascript
// @apps/blog/views/(admin)/posts/_route.js
import PostsList from './PostsList';
import {
  addBreadcrumb,
  registerMenu,
  unregisterMenu,
} from '@shared/renderer/redux';
import { requirePermission } from '@shared/renderer/components/Rbac';

// 1. Middleware - permission check
export const middleware = requirePermission('posts:read');

// 2. Register - called once when route is discovered
export function register({ store, i18n }) {
  store.dispatch(
    registerMenu({
      ns: 'admin',
      item: {
        ns: i18n.t('navigation.content', 'Content'),
        path: '/admin/posts',
        label: i18n.t('navigation.posts', 'Posts'),
        icon: 'file-text',
        permission: 'posts:read',
        order: 20,
      },
    }),
  );
}

// 3. Mount - dispatch breadcrumb
export function mount({ store, i18n, path }) {
  store.dispatch(
    addBreadcrumb(
      { label: i18n.t('navigation.posts', 'Posts'), url: path },
      'admin',
    ),
  );
}

// 4. Page metadata
export async function getInitialProps({ i18n }) {
  return { title: i18n.t('admin.posts.title', 'Posts Management') };
}

// 5. Component export
export default PostsList;
```

**Route Lifecycle Hooks:**

| Hook              | Purpose                      | Called When          |
| ----------------- | ---------------------------- | -------------------- |
| `register`        | Register menus, global state | Route discovered     |
| `unregister`      | Cleanup menus, global state  | Route unloaded       |
| `mount`           | Dispatch breadcrumbs         | Route mounted        |
| `middleware`      | Permission checks, redirects | Before rendering     |
| `getInitialProps` | Data fetching, page metadata | Before rendering     |

> **Note:** Redux reducer injection (`store.injectReducer`) is handled in `views/index.js` `providers()` hook, not in `_route.js`.

### 5. API Module Structure

```javascript
const routesContext = require.context('./routes', true, /\.[cm]?[jt]s$/i);

export function routes() {
  return routesContext;
}

export async function init(container) {
  // Initialize module
}

// @apps/my-module/api/routes.js
import express from 'express';
import * as controller from './controller';

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);

export default router;

// @apps/my-module/api/controller.js
import * as service from './service';

export async function list(req, res) {
  const items = await service.getAll();
  res.json(items);
}

// @apps/my-module/api/service.js
export async function getAll() {
  // Business logic
  return [];
}
```

### 6. Form Validation with React Hook Form + Zod

```javascript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from '@shared/validator';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function LoginForm() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = data => {
    // Handle form submission
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}

      <input type='password' {...register('password')} />
      {errors.password && <span>{errors.password.message}</span>}

      <button type='submit'>Login</button>
    </form>
  );
}
```

## General Coding Standards

1. **Functional Programming:** Favor functional patterns (hooks, pure functions) over class-based code
2. **Modern JavaScript:** Use ES2015+ features (async/await, destructuring, spread, arrow functions)
3. **Named Imports:** Use `import { foo } from 'bar'` for tree-shaking
4. **PropTypes:** Always define PropTypes for components
5. **Async/Await:** Prefer async/await over promise chains
6. **Error Handling:** Use try-catch with meaningful error messages
7. **Logging:** Use `console.log`, `console.error`, `console.warn` (environment-aware)
8. **Configuration:** Use environment variables with `RSK_` prefix
9. **Documentation:** Add JSDoc comments for complex functions
10. **Testing:** Write tests for critical functionality
11. **File Naming:** Use PascalCase for components, camelCase for utilities, kebab-case for CSS modules

## Mandatory Verification After Code Changes

**CRITICAL: After ANY code modification (new features, bug fixes, refactoring, upgrades, or maintenance), you MUST complete these verification steps before considering the task done:**

1. **Identify related tests:** Find all `*.test.js` files related to the changed code (same directory, parent module, or imported by the changed files)
2. **Run targeted tests first:** `npm run test -- <pattern>` for the specific files you changed
3. **Fix until green:** If tests fail, fix the code and re-run. Do NOT skip failing tests
4. **Run full test suite:** `npm test` to catch any cross-module regressions
5. **Run linting:** `npm run lint` to ensure code style compliance
6. **Update tests if behavior changed:** If you modified public API, return types, or function signatures, update the corresponding tests to match

> **This applies to ALL code changes, including:** modifying existing modules, upgrading dependencies, refactoring internals, fixing bugs, adding hooks, and extension modifications. There are NO exceptions.

## Environment Variables

All environment variables use the `RSK_` prefix for consistency. Key variables (see `.env.rsk`):

```bash
# Server Configuration
RSK_PORT=1337
RSK_HOST=127.0.0.1

# Application Metadata
RSK_APP_NAME="React Starter Kit"
RSK_APP_DESC="Boilerplate for React.js web applications"

# Database
RSK_DB_URL=sqlite:database.sqlite
# PostgreSQL: postgresql://user:password@localhost:5432/dbname

# Authentication
RSK_JWT_SECRET=                # Auto-generated on first run
RSK_JWT_EXPIRY=7d

# Node-RED (Optional)
RSK_NODERED_URL=http://localhost:1880

# Build Configuration (Optional)
WEBPACK_ANALYZE=false
WEBPACK_PROFILE=false
```

**Important:** Environment variables are baked into the bundle at build time. Changing them requires rebuilding.

## Development Workflow

1. **Start development:** `npm run dev`
2. **Make changes:** Edit files in `src/`
3. **See updates:** HMR updates browser automatically
4. **Run tests:** `npm run test` or `npm run test:watch`
5. **Lint code:** `npm run lint` or `npm run fix`
6. **Build production:** `npm run build`
7. **Deploy:** Use Docker or direct Node.js deployment

## Production Deployment

```bash
# Build for production
npm run build

# Navigate to build directory
cd build

# Install production dependencies
npm install --production

# Set environment variables
export NODE_ENV=production
export RSK_JWT_SECRET=$(openssl rand -base64 32)
export RSK_DB_URL=postgresql://user:pass@localhost:5432/dbname

# Start server
npm start

# Or use Docker
docker build -t rapid-rsk .
docker run -p 1337:1337 \
  -e NODE_ENV=production \
  -e RSK_JWT_SECRET=your-secret \
  -e RSK_DB_URL=postgresql://user:pass@host:5432/db \
  rapid-rsk
```

## Key Features

### RBAC (Role-Based Access Control)

- **Users:** Core user accounts with authentication
- **Roles:** Named collections of permissions (e.g., "Admin", "Editor")
- **Groups:** User groupings for organizational structure
- **Permissions:** Granular access control (e.g., "users:read", "users:write")
- **API:** Full CRUD operations for users, roles, groups, permissions
- **Middleware:** `requireAuth`, `requirePermission`, `requireRole`

### WebSocket

- Real-time bidirectional communication
- Token-based authentication
- Automatic reconnection handling
- Client API in `shared/ws/`

### Worker Processes

- Background job processing
- Concurrency control with worker pools
- Queue management for heavy tasks
- Integration with Schedule Engine for cron jobs

## Common Patterns

### Fetching Data in Pages

```javascript
// @apps/(default)/views/users/_route.js
import React from 'react';
import UsersPage from './UsersPage';

export async function getInitialProps({ fetch, store }) {
  // Option 1: Direct fetch
  const { data } = await fetch('/api/users');

  // Option 2: Dispatch thunk
  // await store.dispatch(fetchUsers());

  return {
    title: 'Users',
    users: data, // Passed as props to component
  };
}

export default UsersPage;
```

### Protected Routes

```javascript
import { requireAuth } from '@shared/api/auth/middlewares';

router.get('/protected', requireAuth, (req, res) => {
  // req.user is available
  res.json({ user: req.user });
});
```

### Scheduled Tasks

```javascript
import schedule from '@shared/api/schedule';

schedule.register('daily-cleanup', '0 0 * * *', async () => {
  // Lightweight task or dispatch to worker
  console.log('Running daily cleanup');
});
```

### Database Models

```javascript
// @apps/my-module/api/models/MyModel.js
export default function createMyModel(connection, DataTypes) {
  const MyModel = sequelize.define('MyModel', {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  return MyModel;
}
```

## Testing Patterns

```javascript
// Component tests
import React from 'react';
import { render, screen } from '@testing-library/react';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent title='Test' />);
    expect(screen.getByText(/Test/i)).toBeInTheDocument();
  });
});

// Redux tests
import configureStore from '@shared/renderer/redux/configureStore';
import { increment } from './slice';

describe('myFeature slice', () => {
  it('increments value', () => {
    const store = configureStore();
    store.dispatch(increment());
    expect(store.getState().myFeature.value).toBe(1);
  });
});
```

### Benchmark Tests

> Performance-oriented suites that measure execution time. Benchmarks
> are kept separate from regular unit tests and are executed with a
> dedicated command.

- **File naming:** create `*.benchmark.js` files alongside the code you
  want to measure (common to put examples in `src/benchmarks/`).
- **Running:** use `npm run benchmark` or `node tools/run benchmark`.
  The task will invoke Jest in "benchmark mode" (`JEST_BENCHMARK=true`)
  which only loads files matching the pattern and disables coverage to
  avoid skewing timings.
- **Writing:** benchmarks are just Jest tests, so you can use the
  standard `describe/it` syntax and any test helpers. Use
  `performance.now()` or libraries like `benchmark` if you prefer.
- **Example:** see `src/benchmarks/example.benchmark.js` for a simple
  fibonacci timing.

Benchmarks help catch regressions and guide optimization work without
polluting the regular test suite.

```

## Important Notes

1. **No i18n generation:** The i18n extraction task was removed. i18next is still used for runtime translations.
2. **Auto-discovery:** Both API modules and pages are auto-discovered. Follow naming conventions.
3. **RSK\_ prefix:** All custom environment variables use the `RSK_` prefix.
4. **JWT auto-generation:** JWT secret is auto-generated during build if not set.
5. **Module naming:** Prefix module names with alphanumeric characters and underscores to control load order.
6. **CSS Modules:** Use `.module.css` extension for CSS Modules, or plain `.css` for global styles.
7. **Barrel exports:** Avoid circular dependencies by using direct imports when possible.

## Documentation

- **README.md** — Quick start and overview
- **AGENT.md** — This file; full architecture guide for AI agents
- **.agent/rules.md** — Hard rules and coding constraints
- **.agent/workflows/** — 23 step-by-step development guides
- **.agent/skills/** — 12 specialized AI persona skills
- **.agent/templates/SPEC.template.md** — Feature specification template
- **.env.rsk** — Environment variable documentation
- **CONTRIBUTING.md** — Contribution guidelines and commit conventions

## Support

For issues and questions, refer to:

- GitHub Issues: https://github.com/xuanhoa88/rapid-rsk/issues
- Repository: https://github.com/xuanhoa88/rapid-rsk
