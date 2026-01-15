# React Starter Kit - AI Assistant Guide

## Project Overview

Production-ready React application boilerplate with server-side rendering (SSR), built on React 16+, Express, and Webpack 5. Supports React 16, 17, and 18+ with backward compatibility. This is a **single-repository** full-stack application with comprehensive tooling for modern web development.

## Project Structure

```
react-starter-kit/
├── src/                    # Application source code
│   ├── components/         # React components (App, Html, Layout)
│   ├── routes/            # Route components and definitions
│   ├── data/              # Data layer (models, queries, types)
│   ├── client.js          # Client-side entry point
│   ├── server.js          # Server-side entry point (Express)
│   ├── router.js          # Universal router configuration
│   ├── config.js          # Application configuration
│   └── createFetch.js     # Universal HTTP client
├── tools/                 # Build tools and tasks
│   ├── tasks/             # Build tasks (build, start, clean, etc.)
│   ├── webpack/           # Webpack configurations (client, server)
│   ├── lib/               # Shared utilities (fs, logger, errorHandler)
│   ├── config.js          # Build configuration
│   └── run.js             # Task runner
├── build/                 # Production build output
├── public/                # Static assets
├── docs/                  # Comprehensive documentation
└── locales/               # i18n translation files
```

## Tech Stack

### Core

- **Runtime:** Node.js >= 16.0.0
- **Package Manager:** npm >= 7.0.0
- **Language:** JavaScript (ES2015+) with JSX

### Frontend

- **React:** 16+ (supports React 16, 17, and 18+ with backward compatibility)
- **State Management:** Redux 7.2.9 with React Redux hooks
- **Routing:** Universal router with code splitting
- **Styling:** CSS Modules + PostCSS + Autoprefixer
- **i18n:** react-i18next 14.1.3 with i18next 23.15.2

### Backend

- **Server:** Express 4.21.1 (Node.js 16+ compatible)
- **Authentication:** JWT (jsonwebtoken 9.0.2 + express-jwt 8.4.1)
- **Database:** Sequelize 6.37.5 ORM (supports PostgreSQL, MySQL, SQLite)
- **Middleware:** body-parser 1.20.3, cookie-parser 1.4.7, express-request-language 1.1.15

### Build Tools

- **Bundler:** Webpack 5 with code splitting and tree shaking
- **Transpiler:** Babel 7 with preset-env and preset-react
- **CSS Processing:** PostCSS with autoprefixer and CSS Modules
- **HMR:** React Refresh + webpack-hot-middleware

### Code Quality

- **Linting:** ESLint with @babel/eslint-parser
- **CSS Linting:** Stylelint
- **Formatting:** Prettier 2.8.8
- **Testing:** Jest with React Testing Library

### DevOps

- **Docker:** Production-ready Dockerfile
- **Process Management:** PM2 support
- **Logging:** Centralized logger with hierarchical levels

## Essential Commands

```bash
# Development
npm start                      # Start dev server with HMR (http://localhost:1337)
npm run build                  # Build for production
npm run clean                  # Clean build directory

# Testing
npm test                       # Run all tests
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

# Internationalization
npm run i18n                   # Extract i18n messages
```

## Architecture Patterns

### 1. Universal Rendering (SSR)

- Server renders initial HTML for fast page loads and SEO
- Client hydrates and takes over for SPA experience
- Shared code between client and server
- Critical CSS extraction for above-the-fold content

### 2. Code Splitting

- Route-based code splitting with dynamic imports
- Webpack chunks for optimal bundle sizes
- Automatic chunk loading on navigation

### 3. State Management

- Redux for global state (user, intl)
- React Context for app-level context (insertCss, fetch, pathname)
- Custom hooks (useAppContext) for accessing context

### 4. Authentication

- JWT-based authentication with HTTP-only cookies
- Express middleware for protected routes
- Auth endpoints: /auth/register, /auth/login, /auth/logout, /auth/me

### 5. Build System

- Centralized configuration in tools/config.js
- Task-based architecture (build, start, clean, i18n)
- Metadata-driven task runner (keepAlive for long-running tasks)
- Comprehensive error handling with BuildError class

## Code Conventions

### 1. Component Patterns

```javascript
// Prefer functional components with hooks
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAppContext } from '../hooks/useAppContext';

function MyComponent({ title }) {
  const { fetch, pathname } = useAppContext();
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data').then(setData);
  }, [fetch]);

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

### 2. Redux Integration

```javascript
// Use hooks for Redux
import { useSelector, useDispatch } from 'react-redux';

function MyComponent() {
  const user = useSelector(state => state.user);
  const dispatch = useDispatch();

  const handleLogin = () => {
    dispatch({ type: 'SET_USER', payload: userData });
  };

  return <div>{user?.name}</div>;
}
```

### 3. Styling with CSS Modules

```javascript
import React, { useEffect } from 'react';
import { useAppContext } from '../hooks/useAppContext';
import s from './MyComponent.css';

function MyComponent() {
  const { insertCss } = useAppContext();

  useEffect(() => {
    const removeCss = insertCss(s);
    return () => removeCss();
  }, [insertCss]);

  return <div className={s.container}>Content</div>;
}
```

### 4. Routing

```javascript
// Route definition in src/routes/
export default {
  path: '/example',
  title: 'Example Page',
  description: 'Example page description',

  async action({ fetch, params, query }) {
    const data = await fetch('/api/example');

    return {
      title: 'Example Page',
      component: <ExamplePage data={data} />,
    };
  },
};
```

### 5. Error Handling

```javascript
// Use BuildError for rich error context
import { BuildError } from './lib/errorHandler';

try {
  await someOperation();
} catch (error) {
  throw new BuildError('Operation failed', 'OPERATION_ERROR', {
    originalError: error,
    context: 'additional info',
  });
}
```

## General Coding Standards

1. **Functional Programming:** Favor functional patterns (hooks, pure functions) over class-based code
2. **Modern JavaScript:** Use ES2015+ features (async/await, destructuring, spread, arrow functions)
3. **Named Imports:** Use `import { foo } from 'bar'` for tree-shaking and clarity
4. **PropTypes:** Always define PropTypes for components
5. **Async/Await:** Prefer async/await over promise chains
6. **Error Handling:** Use try-catch with meaningful error messages
7. **Logging:** Use centralized logger (logInfo, logError, logWarn, logDebug)
8. **Configuration:** Use environment variables via tools/config.js
9. **Documentation:** Add JSDoc comments for complex functions
10. **Testing:** Write tests for critical functionality

## Key Documentation Files

Refer to these docs for detailed information:

- **docs/REDUX_MIGRATION_GUIDE.md** - Redux integration with React 16+
- **docs/ESLINT_PRETTIER_UPDATE.md** - Code quality tooling
- **docs/JEST_ENHANCEMENTS.md** - Testing configuration
- **docs/SERVER_IMPROVEMENTS_COMPLETE.md** - SSR enhancements
- **docs/CLIENT_IMPROVEMENTS.md** - Client-side enhancements
- **docs/BUILD_ENHANCEMENTS.md** - Build system improvements
- **docs/FS_ENHANCEMENTS.md** - File system utilities
- **docs/FETCH_ENHANCEMENTS.md** - HTTP client features

## Environment Variables

Key environment variables (see .env.defaults):

```bash
# Server
PORT=1337
NODE_ENV=development

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Database
DATABASE_URL=postgres://user:pass@localhost:5432/dbname

# Build
BUILD_ANALYZE=false
BUILD_PROFILE=false
BUILD_PARALLEL=false

# Logging
LOG_LEVEL=info
```

## Development Workflow

1. **Start development:** `npm start`
2. **Make changes:** Edit files in src/
3. **See updates:** HMR updates browser automatically
4. **Run tests:** `npm test` or `npm run test:watch`
5. **Lint code:** `npm run lint` or `npm run fix`
6. **Build production:** `npm run build`
7. **Deploy:** Use Docker or PM2 for production

## Production Deployment

```bash
# Build for production
npm run build

# Change to build directory and install dependencies
cd build
npm install --production

# Start with PM2
pm2 start server.js --name react-app

# Or run directly
export NODE_ENV=production
export RSK_JWT_SECRET=$(openssl rand -base64 32)
node server.js

# Or use Docker
docker build -t react-app .
docker run -p 1337:1337 react-app
```
