# Shared Renderer — Technical Specification

## Overview

`shared/renderer/` provides the client-side infrastructure: React application shell, view autoloading, file-based client routing, Redux state management, and shared UI components.

## Architecture

```
shared/renderer/
├── App.js              # Root component (provider composition)
├── Html.js             # SSR HTML shell (meta, hydration, OG tags)
├── autoloader.js       # View module lifecycle orchestrator
├── Providers/
│   └── History.js      # Browser history context provider
├── router/             # Client-side radix-tree router
│   ├── index.js        # Router class (resolve, register, mount/unmount)
│   ├── collector.js    # View file collector (routes, configs, layouts)
│   ├── builder.js      # Route tree builder
│   ├── lifecycle.js    # Route lifecycle hooks (init, mount, unmount, translations)
│   ├── matcher.js      # Radix-tree URL matching (generator-based)
│   ├── utils.js        # Path and segment utilities
│   └── constants.js    # File-naming conventions
├── redux/              # Redux state management
│   ├── configureStore.js  # Store factory (middleware, persistence, hot reload)
│   ├── rootReducer.js     # Combined reducer
│   └── features/          # Redux Ducks modules
│       ├── runtime/       # Runtime variables (locale, theme, env)
│       ├── intl/          # Internationalization state
│       ├── user/          # Authentication state
│       └── ui/            # UI state (modals, sidebars, toasts)
└── components/         # Shared UI component library
    ├── variables.css   # CSS design tokens
    └── 19 components   # See Components section
```

## Components Detail

### 1. Application Shell

#### `App.js` — Root Component

Composes the provider tree (memoized to prevent re-renders):

```
ReduxProvider → I18nextProvider → HistoryProvider → children
```

**Context shape:**

| Property    | Type       | Description           |
| ----------- | ---------- | --------------------- |
| `container` | `Object`   | DI container          |
| `fetch`     | `Function` | Universal HTTP client |
| `store`     | `Object`   | Redux store           |
| `history`   | `Object`   | Browser history       |
| `i18n`      | `Object`   | i18next instance      |
| `locale`    | `string`   | Current locale        |
| `pathname`  | `string`   | Current URL path      |
| `query`     | `Object`   | Query parameters      |

#### `Html.js` — SSR Shell

Server-side rendered HTML document with:

- SEO meta tags (`<title>`, `<meta description>`)
- Open Graph meta (`og:title`, `og:description`, `og:image`, etc.)
- CSS/JS injection with `data-extension-id` support
- State hydration via `window.__PRELOADED_STATE__`
- PWA manifest and CSP nonce support

### 2. View Autoloader (`autoloader.js`)

Discovers and boots view modules. Mirrors the API autoloader pattern.

#### Lifecycle Phases (sequential)

| #   | Phase          | Hook Signature                       | Purpose                      |
| --- | -------------- | ------------------------------------ | ---------------------------- |
| 1   | `translations` | `translations()` → `require.context` | Register i18n namespaces     |
| 2   | `providers`    | `providers({ container })`           | Bind client-side DI services |
| 3   | `views`        | `views()` → `require.context`        | Collect view route contexts  |

#### Adapter Merging

After collecting per-module view adapters, `mergeAdapters()` produces a single unified adapter. This ensures layouts from any module (e.g. admin layout from core) are globally visible when building routes for other modules.

### 3. Client Router (`router/`)

File-based radix-tree router with full CSR lifecycle support.

#### File Conventions

| Pattern      | Meaning                                                   |
| ------------ | --------------------------------------------------------- |
| `_route.js`  | View route (exports `action` function or React component) |
| `_config.js` | Route configuration                                       |
| `_layout.js` | Layout wrapper component                                  |
| `(name)/`    | Route group (not in URL)                                  |
| `[param]/`   | Dynamic segment → `:param`                                |

#### Route Lifecycle (per navigation)

```
translations → init → unmount(previous) → mount(current) → resolve(action)
```

| Hook           | When             | Purpose                        |
| -------------- | ---------------- | ------------------------------ |
| `translations` | Once per route   | Load route-specific i18n       |
| `init`         | Once per route   | One-time setup (data prefetch) |
| `unmount`      | Per navigation   | Cleanup previous route         |
| `mount`        | Per navigation   | Setup current route            |
| `register`     | On first resolve | One-time registration          |
| `unregister`   | On cleanup       | Teardown                       |

#### Navigation Queue

The router uses a `NavigationEntry` queue to prevent race conditions during rapid navigation. Only the **latest** navigation is executed; intermediate ones are cancelled.

#### Dynamic Routes

Routes can be added/removed at runtime:

```javascript
const adapter = router.add(extensionAdapter); // Merges into existing tree
router.remove(extensionAdapter); // Removes by adapter reference (source tagging)
```

### 4. Redux (`redux/`)

#### Store Configuration

`configureStore.js` creates a Redux store with:

- Custom middleware chain
- State persistence (optional)
- Hot module replacement for reducers
- Feature-based reducer composition

#### Features (Ducks Pattern)

Each feature follows the Redux Ducks structure:

```
features/{name}/
├── index.js       # Public API (actions, selectors, reducer)
├── actions.js     # Action creators (private)
├── constants.js   # Action types (private)
├── selector.js    # Selectors (private)
└── reducer.js     # State reducer (private)
```

| Feature   | Slice           | Purpose                           |
| --------- | --------------- | --------------------------------- |
| `runtime` | `state.runtime` | Locale, theme, env flags          |
| `intl`    | `state.intl`    | i18n locale and messages          |
| `user`    | `state.user`    | Auth state, profile, tokens       |
| `ui`      | `state.ui`      | Modals, sidebars, toasts, loading |

### 5. UI Component Library

| Component          | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `Avatar`           | User avatar with fallback                                |
| `Box`              | Flexible layout container                                |
| `Button`           | Button with variants and loading state                   |
| `Card`             | Card container with header/body/footer                   |
| `ConfirmModal`     | Confirmation dialog                                      |
| `ContextMenu`      | Right-click / dropdown menu                              |
| `Form`             | Form primitives (Input, Select, Checkbox, WYSIWYG, etc.) |
| `History`          | Navigation history utilities                             |
| `Icon`             | Icon component with sprite support                       |
| `InfiniteScroll`   | Scroll-based pagination                                  |
| `Loader`           | Loading spinner/skeleton                                 |
| `Modal`            | Modal dialog system                                      |
| `Rbac`             | Role-based access control wrappers                       |
| `SearchableSelect` | Searchable dropdown select                               |
| `Table`            | Data table with sorting/pagination                       |
| `Tabs`             | Tabbed interface                                         |
| `Tag`              | Tag/badge component                                      |
| `Toast`            | Toast notification system                                |
| `WYSIWYG`          | Rich text editor (Tiptap)                                |

All components import from `variables.css` for consistent design tokens.
