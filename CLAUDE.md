# React Starter Kit - AI Assistant Guide

## Project Overview

**Rapid RSK** is a production-ready, full-stack React application with server-side rendering (SSR), built on React 18, Express 4, and Webpack 5. This is a **single-repository** application with comprehensive tooling, RBAC, WebSocket support, and Node-RED integration for modern web development.

## Project Structure

```
react-starter-kit/
├── src/                          # Application source code
│   ├── bootstrap/                # API bootstrap logic
│   ├── engines/                  # Core API infrastructure
│   │   ├── auth/                 # Authentication & JWT
│   │   ├── cache/                # Caching layer
│   │   ├── db/                   # Database & Sequelize
│   │   ├── email/                # Email service
│   │   ├── fs/                   # File system utilities
│   │   ├── http/                 # HTTP response helpers
│   │   ├── queue/                # Job queue
│   │   ├── schedule/             # Cron jobs
│   │   ├── webhook/              # Webhook handling
│   │   └── worker/               # Background workers
│   ├── modules/                  # Business logic modules
│   │   ├── users/                # User management, auth, RBAC
│   ├── components/               # Reusable React components
│   ├── pages/                    # Page components (auto-discovered routes)
│   │   ├── admin/                # Admin panel pages
│   │   └── index.js              # Page discovery and routing
│   ├── shared/                   # Shared utilities
│   │   ├── renderer/             # SSR components (App, Html, Navigator, Redux)
│   │   ├── fetch/                # Universal HTTP client
│   │   ├── ws/                   # WebSocket client/server
│   │   ├── i18n/                 # i18n utilities
│   │   └── validator/            # SSR validator utilities
│   ├── client.js                 # Client-side entry point
│   └── server.js                 # Server-side entry point (Express)
├── tools/                        # Build tools and tasks
│   ├── tasks/                    # Build tasks (build, dev, clean, test, etc.)
│   ├── utils/                    # Build utilities (fs, logger, etc.)
│   ├── jest/                     # Jest configuration
│   ├── webpack/                  # Webpack configurations
│   └── run.js                    # Task runner
├── build/                        # Production build output
├── public/                       # Static assets
├── .claude/                      # AI assistant command guides
│   └── commands/                 # Development command documentation
└── .env.rsk                      # Environment variable template
```

## Tech Stack

### Core

- **Runtime:** Node.js >= 16.0.0
- **Package Manager:** npm >= 7.0.0
- **Language:** JavaScript (ES2015+) with JSX

### Frontend

- **React:** 18.3.1 with SSR and hydration
- **State Management:** Redux 5.0.1 + Redux Toolkit 2.11.1
- **Routing:** Custom page auto-discovery with dynamic imports
- **Code Splitting:** @loadable/component 5.16.4
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

- Automatically discovers modules in `src/modules/`
- Each module can export models, routes, and initialization logic
- Modules are loaded in two phases: models first, then routes

**Pages** (`src/pages/index.js`):

- Automatically discovers page components using `require.context`
- Supports nested routes and admin pages
- Each page exports a route configuration with path, action, and metadata

### 2. Engines vs Modules

**Engines** (`src/engines/`):

- Core infrastructure: `auth`, `cache`, `db`, `email`, `fs`, `http`, `queue`, `schedule`, `webhook`, `worker`
- Provide reusable capabilities for modules
- Should not contain business logic

**Modules** (`src/modules/`):

- Business domains: `users`, `homepage`
- Consume engines to implement features
- Each module can have: `index.js`, `model.js`, `controller.js`, `service.js`, `routes.js`

### 3. Universal Rendering (SSR)

- Server renders initial HTML for fast page loads and SEO
- Client hydrates and takes over for SPA experience
- Shared code between client and server
- Redux state is serialized and transferred from server to client

### 4. State Management

- **Redux Toolkit** for global state management
- **Features:** `runtime`, `user`, `ui` (in `src/shared/renderer/redux/features/`)
- **Store Configuration:** `src/shared/renderer/redux/configureStore.js`
- **Middleware:** Redux Logger (dev only), custom middleware for async actions
- **Helpers:** Store receives `fetch`, `history`, `i18n` as extra arguments

### 5. Authentication & Authorization

- **JWT-based authentication** with HTTP-only cookies
- **RBAC system:** Users, Roles, Groups, Permissions
- **Middleware:** `src/engines/auth/middleware.js`
- **Protected routes:** Use `requireAuth` middleware
- **API endpoints:** `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`, `/api/auth/register`

### 6. WebSocket Integration

- WebSocket server runs alongside Express server
- Token-based authentication for WebSocket connections
- Client connects via `src/shared/ws/`
- Server implementation in `src/server.js` (`initWebSocket`)

### 7. Worker Pattern

For heavy processing, use the Worker Engine:

```javascript
// 1. Define worker
import { createWorkerHandler } from '@/engines/worker';
// ... (omitting lines for brevity in tool call, standardizing on contiguous blocks is better but small edits are fine) with context:
// wait, I need exact match.

const myTaskLogic = async payload => {
  // Heavy processing
  return { success: true };
};

export default createWorkerHandler(myTaskLogic, 'MY_TASK_TYPE');

// 2. Create worker pool
import { createWorkerPool } from '@/engines/worker';

const workersContext = require.context('.', false, /\.worker\.js$/);
const workerPool = createWorkerPool(workersContext, {
  engineName: 'MyDomain',
  maxWorkers: 2,
});

// 3. Dispatch jobs
await workerPool.sendRequest('task-name', 'MY_TASK_TYPE', payload);
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
// Feature slice (src/shared/renderer/redux/features/myFeature/slice.js)
import { createSlice } from '@reduxjs/toolkit';

const myFeatureSlice = createSlice({
  name: 'myFeature',
  initialState: { value: 0 },
  reducers: {
    increment: state => {
      state.value += 1;
    },
  },
});

export const { increment } = myFeatureSlice.actions;
export default myFeatureSlice.reducer;

// Thunks (src/shared/renderer/redux/features/myFeature/thunks.js)
export const fetchData =
  () =>
  async (dispatch, getState, { fetch }) => {
    const response = await fetch('/api/data');
    dispatch(setData(response));
  };
```

### 3. Styling with CSS Modules

```javascript
import React from 'react';
import s from './MyComponent.module.css';

function MyComponent() {
  return <div className={s.container}>Content</div>;
}
```

### 4. Page Routing

```javascript
// src/pages/example/index.js
import React from 'react';
import ExamplePage from './ExamplePage';

export default {
  path: '/example',

  async action({ fetch, params, query, store }) {
    // Fetch data, dispatch actions, etc.
    const data = await fetch('/api/example');

    return {
      title: 'Example Page',
      description: 'Example page description',
      component: <ExamplePage data={data} />,
    };
  },
};
```

### 5. API Module Structure

```javascript
// src/modules/my-module/index.js
export default function initMyModule(app, { db, auth }) {
  // Module initialization
  const router = require('./routes').default;
  app.use('/api/my-module', router);
}

// src/api/modules/my-module/routes.js
import express from 'express';
import * as controller from './controller';

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);

export default router;

// src/api/modules/my-module/controller.js
import * as service from './service';

export async function list(req, res) {
  const items = await service.getAll();
  res.json(items);
}

// src/api/modules/my-module/service.js
export async function getAll() {
  // Business logic
  return [];
}
```

### 6. Form Validation with React Hook Form + Zod

```javascript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

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

## Environment Variables

All environment variables use the `RSK_` prefix for consistency. Key variables (see `.env.rsk`):

```bash
# Server Configuration
RSK_PORT=1337
RSK_HOST=localhost
RSK_HTTPS=false

# Application Metadata
RSK_APP_NAME="React Starter Kit"
RSK_APP_DESCRIPTION="Boilerplate for React.js web applications"

# API Gateway
RSK_API_BASE_URL=              # Leave empty for relative URLs
RSK_API_PROXY_URL=             # Optional external API proxy

# Database
RSK_DATABASE_URL=sqlite:database.sqlite
# PostgreSQL: postgresql://user:password@localhost:5432/dbname

# Authentication
RSK_JWT_SECRET=                # Auto-generated on first run
RSK_JWT_EXPIRES_IN=7d

# Node-RED (Optional)
RSK_NODE_RED_URL=http://localhost:1880

# Build Configuration (Optional)
BUNDLE_ANALYZE=false
BUNDLE_PROFILE=false
LOG_LEVEL=info
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
export RSK_DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Start server
node server.js

# Or use Docker
docker build -t rapid-rsk .
docker run -p 1337:1337 \
  -e NODE_ENV=production \
  -e RSK_JWT_SECRET=your-secret \
  -e RSK_DATABASE_URL=postgresql://user:pass@host:5432/db \
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
- Client API in `src/shared/ws/`

### Worker Processes

- Background job processing
- Concurrency control with worker pools
- Queue management for heavy tasks
- Integration with Schedule Engine for cron jobs

## Common Patterns

### Fetching Data in Pages

```javascript
export default {
  path: '/users',

  async action({ fetch, store }) {
    // Option 1: Direct fetch
    const users = await fetch('/api/users');

    // Option 2: Dispatch thunk
    await store.dispatch(fetchUsers());

    return {
      title: 'Users',
      component: <UsersPage />,
    };
  },
};
```

### Protected Routes

```javascript
import { requireAuth } from '@/engines/auth/middleware';

router.get('/protected', requireAuth, (req, res) => {
  // req.user is available
  res.json({ user: req.user });
});
```

### Scheduled Tasks

```javascript
import schedule from '@/engines/schedule';

schedule.register('daily-cleanup', '0 0 * * *', async () => {
  // Lightweight task or dispatch to worker
  console.log('Running daily cleanup');
});
```

### Database Models

```javascript
// src/modules/my-module/model.js
export default function defineModel(sequelize, DataTypes) {
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
import configureStore from '@/shared/renderer/redux/configureStore';
import { increment } from './slice';

describe('myFeature slice', () => {
  it('increments value', () => {
    const store = configureStore();
    store.dispatch(increment());
    expect(store.getState().myFeature.value).toBe(1);
  });
});
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

- **README.md** - Quick start and overview
- **src/bootstrap/GUIDELINES.md** - API architecture patterns
- **.env.rsk** - Environment variable documentation
- **Conversation history** - Recent refactorings and decisions

## Support

For issues and questions, refer to:

- GitHub Issues: https://github.com/xuanhoa88/rapid-rsk/issues
- Repository: https://github.com/xuanhoa88/rapid-rsk
