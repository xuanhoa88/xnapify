# Project Structure

This document explains the organization of the React Starter Kit codebase.

## 📁 Directory Overview

```
react-starter-kit/
├── public/              # Static assets served directly
├── src/                 # Application source code
├── tools/               # Build and development tools
├── docs/                # Documentation
├── test/                # Test utilities and setup
├── build/               # Production build output (generated)
└── node_modules/        # Dependencies (generated)
```

## 📂 Source Directory (`src/`)

### Entry Points

```
src/
├── client.js            # Client-side entry point (browser)
├── server.js            # Server-side entry point (Node.js)
└── router.js            # Universal router configuration
```

- **`client.js`** - Initializes the React app in the browser, handles HMR
- **`server.js`** - Express server with SSR, API routes, and middleware
- **`router.js`** - Defines routes that work on both server and client

### Components

```
src/components/
├── App.js               # Root application component
├── Html.js              # HTML document template (SSR)
├── Layout/              # Main layout wrapper
├── Header/              # Site header with navigation
├── Footer/              # Site footer
├── Navigation/          # Navigation menu
├── Page/                # Page wrapper component
├── Feedback/            # User feedback widget
└── LanguageSwitcher/    # Language selection component
```

**Component Structure:**

```
ComponentName/
├── index.js             # Component logic
├── ComponentName.css    # Component styles (CSS Modules)
└── ComponentName.test.js # Component tests
```

### Routes (Pages)

```
src/routes/
├── index.js             # Routes registry
├── home/                # Home page
├── about/               # About page
├── contact/             # Contact page
├── login/               # Login page
├── register/            # Registration page
├── admin/               # Admin dashboard
├── privacy/             # Privacy policy
├── not-found/           # 404 page
└── error/               # Error page
```

**Route Structure:**

```
route-name/
├── index.js             # Route configuration and data loading
├── RouteName.js         # Page component
└── RouteName.css        # Page styles
```

**Route Configuration Example:**

```javascript
export default {
  path: '/about',

  async action({ fetch }) {
    const data = await fetch('/api/about');

    return {
      title: 'About Us',
      description: 'Learn more about our company',
      component: <About data={data} />,
    };
  },
};
```

### State Management (Feature-Based Redux)

```
src/redux/
├── features/            # Feature modules (self-contained)
│   ├── intl/            # Internationalization feature
│   │   ├── index.js     # Public API
│   │   ├── actions.js   # Intl actions
│   │   ├── constants.js # Intl action types
│   │   └── reducer.js   # Intl state reducer
│   ├── runtime/         # Runtime variables feature
│   │   ├── index.js     # Public API
│   │   ├── actions.js   # Runtime actions
│   │   ├── constants.js # Runtime action types
│   │   └── reducer.js   # Runtime state reducer
│   └── user/            # User authentication feature
│       ├── index.js     # Public API
│       └── reducer.js   # User state reducer
├── configureStore.js    # Redux store setup
├── rootReducer.js       # Combines all feature reducers
└── index.js             # Main export (public API)
```

### API & Database

```
src/api/
├── routes/              # API route handlers
│   ├── index.js         # API router
│   ├── auth.js          # Authentication endpoints
│   └── news.js          # News endpoints
├── models/              # Database models (Sequelize)
│   ├── index.js         # Model registry
│   ├── User.js          # User model
│   └── News.js          # News model
└── sequelize.js         # Database connection
```

### Internationalization

```
src/i18n/
├── index.js             # i18next configuration export
├── i18next.config.js    # i18next setup
└── translations/        # Translation files
    ├── en-US.json       # English translations
    └── vi-VN.json       # Vietnamese translations
```

### Utilities

```
src/
├── createFetch.js       # Enhanced fetch utility with interceptors
└── navigator.js         # Client-side navigation helper
```

## 🛠️ Tools Directory (`tools/`)

### Build Tasks

```
tools/tasks/
├── build.js             # Production build orchestration
├── bundle.js            # Webpack bundling
├── clean.js             # Clean build artifacts
├── copy.js              # Copy static files
└── start.js             # Development server
```

### Webpack Configuration

```
tools/webpack/
├── webpack.config.js    # Main webpack configuration
├── client.js            # Client bundle config
├── server.js            # Server bundle config
└── dotenvPlugin.js      # Environment variable injection
```

### Utilities

```
tools/lib/
├── fs.js                # File system utilities
├── cp.js                # Child process utilities
└── logger.js            # Logging utilities
```

### Configuration

```
tools/
├── config.js            # Centralized build configuration
├── postcss.config.js    # PostCSS configuration
└── run.js               # Task runner
```

## 📄 Static Assets (`public/`)

```
public/
├── rsk.ico              # Site favicon
├── robots.txt           # Search engine directives
├── humans.txt           # Credits
├── sitemap.xml          # Site map
└── ...                  # Other static files
```

Static files are served directly and copied to `build/public/` during production build.

## 🏗️ Build Output (`build/`)

Generated during production build:

```
build/
├── server.js            # Compiled server bundle
├── loadable-stats.json  # @loadable/component chunk mapping for SSR
├── public/              # Static assets and client bundles
│   ├── client.js        # Client application bundle
│   ├── client.css       # Extracted CSS
│   ├── *.chunk.js       # Code-split chunks
│   └── ...              # Static files from public/
```

## 📝 Configuration Files

### Root Level

```
.
├── .env                 # Environment variables (gitignored)
├── .env.defaults        # Environment variables template
├── package.json         # Dependencies and scripts
├── .babelrc.js          # Babel configuration
├── .eslintrc.js         # ESLint configuration
├── .prettierrc.js       # Prettier configuration
├── jest.config.js       # Jest testing configuration
├── Dockerfile           # Docker container configuration
└── .gitignore           # Git ignore patterns
```

### Editor Configuration

```
.
├── .editorconfig        # Editor settings
├── .vscode/             # VS Code settings
│   ├── settings.json
│   ├── extensions.json
│   └── launch.json
└── .nvmrc               # Node version specification
```

## 🔄 Data Flow

### Server-Side Rendering (SSR)

1. **Request** → Express server (`src/server.js`)
2. **Route Matching** → Universal Router (`src/router.js`)
3. **Data Loading** → Route's `action()` function
4. **Rendering** → React renders to HTML string
5. **Response** → HTML sent to browser

### Client-Side Navigation

1. **Click Link** → Navigation intercepted
2. **Route Matching** → Universal Router
3. **Data Loading** → Route's `action()` function
4. **Rendering** → React updates DOM
5. **State Update** → Redux store updated

### API Requests

1. **Component** → Calls `fetch()` helper
2. **Fetch Utility** → Adds auth headers, handles errors
3. **API Route** → Express handler (`src/api/routes/`)
4. **Database** → Sequelize model query
5. **Response** → JSON data returned

## 📦 Import Paths

### Absolute Imports

Webpack is configured to resolve from `src/`:

```javascript
// Instead of: import Header from '../../../components/Header'
import Header from 'components/Header';

// Instead of: import { setLocale } from '../../actions/intl'
import { setLocale } from 'actions/intl';
```

### Module Resolution

```javascript
// Components
import Button from 'components/Button';

// Routes
import homeRoute from 'routes/home';

// Actions & Reducers
import { setLocale } from 'actions/intl';

// Constants
import { SET_LOCALE } from 'constants';

// Utilities
import createFetch from 'createFetch';
```

## 🎯 Best Practices

### Component Organization

1. **Keep components small** - Single responsibility principle
2. **Colocate styles** - CSS file next to component
3. **Write tests** - Test file next to component
4. **Use CSS Modules** - Scoped styles by default

### Route Organization

1. **One route per directory** - Clear separation
2. **Data loading in action()** - Async data fetching
3. **SEO metadata** - title, description for each route
4. **Code splitting** - Automatic with dynamic imports

### State Management

1. **Use Redux for global state** - User auth, locale, etc.
2. **Use local state for UI** - Form inputs, toggles, etc.
3. **Keep reducers pure** - No side effects
4. **Use action creators** - Consistent action structure

## 🔍 Finding Code

### By Feature

- **Authentication** → `src/api/routes/auth.js`, `src/routes/login/`, `src/routes/register/`
- **Internationalization** → `src/i18n/`, `src/redux/features/intl/`, `src/components/LanguageSwitcher/`
- **Routing** → `src/router.js`, `src/routes/`, `src/navigator.js`
- **Styling** → `*.css` files, `tools/postcss.config.js`
- **API** → `src/api/routes/`, `src/api/models/`

### By Technology

- **React Components** → `src/components/`, `src/routes/*/`
- **Redux** → `src/redux/` (actions, reducers, store, constants)
- **Express** → `src/server.js`, `src/api/`
- **Webpack** → `tools/webpack/`
- **Database** → `src/api/models/`, `src/api/db.js`

## 📚 Next Steps

- **[Getting Started](getting-started.md)** - Set up your development environment
- **[Development Workflow](development.md)** - Learn the development process
- **[Configuration](configuration.md)** - Configure the application
- **[Data Fetching](data-fetching.md)** - Learn data loading patterns
