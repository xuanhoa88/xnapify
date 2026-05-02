# Shared Renderer

Client-side infrastructure — React application shell, view autoloading, routing, Redux, and shared UI components.

## Quick Start

```jsx
import App from '@shared/renderer/App';
import { configureStore } from '@shared/renderer/redux';
import { Router } from '@shared/renderer/router';
```

## Application Shell

### Provider Tree

`App.js` composes all root providers:

```
Redux → i18next → History → children
```

```jsx
<App context={{ store, i18n, history, fetch, locale, pathname, container }}>
  <Routes />
</App>
```

### SSR Shell

`Html.js` renders the full HTML document with meta tags, OG tags, state hydration, and asset injection.

## View Autoloader

Modules in `src/apps/` export view lifecycle hooks in `views/index.js`:

```
translations → providers → views
```

```javascript
export function translations() { return require.context('../translations', ...); }
export async function providers({ container }) { /* bind client DI */ }
export function views() { return require.context('./routes', ...); }
```

All module view adapters are merged into a single adapter so layouts are globally shared.

## Client Router

File-based radix-tree router for client-side navigation.

### Route Files

```
views/routes/
├── (admin)/                 # Group (stripped from URL)
│   ├── (default)/
│   │   ├── _route.js        # View component / action
│   │   └── _layout.js       # Layout wrapper
│   └── [id]/_route.js       # Dynamic segment → :id
└── _config.js               # Route config
```

### Navigation Lifecycle

```
translations → init → unmount(prev) → mount(current) → resolve
```

### Usage

```javascript
const router = new Router(adapter, { context });
const result = await router.resolve('/dashboard');
```

Dynamic route management:

```javascript
router.add(extensionAdapter);     // Merge extension routes
router.remove(extensionAdapter);  // Remove by adapter reference
```

## Redux

### Store

```javascript
import { configureStore } from '@shared/renderer/redux';
const store = configureStore(initialState);
```

### Features (Ducks Pattern)

| Feature | Description |
|---|---|
| `runtime` | Locale, theme, env flags |
| `intl` | i18n locale and messages |
| `user` | Auth state, profile, tokens |
| `ui` | Modals, sidebars, toasts, loading |

```javascript
import { features } from '@shared/renderer/redux';

const { setLocale, selectLocale } = features;

dispatch(setLocale('fr'));
const locale = selectLocale(getState());
```

## UI Components

14 shared application components extending Radix UI design primitives:

| Component | Description |
|---|---|
| `ContextMenu` | Dropdown / right-click menu |
| `Extension` | Extension slots and hooks |
| `Form` | Form primitives (Input, Select, etc.) |
| `History` | Link and routing hooks |
| `Icon` | Icon sprite component |
| `InfiniteScroll` | Scroll-based pagination |
| `Loader` | Spinner / skeleton |
| `Modal` | Dialog system and confirmation modals |
| `Portal` | React portal wrapper |
| `Rbac` | Role-based access control |
| `SearchableSelect` | Searchable dropdown |
| `Table` | Data table with sorting and pagination |
| `Toast` | Notifications |
| `WYSIWYG` | Rich text editor (Tiptap) |

> **Note:** Basic design primitives (`Avatar`, `Box`, `Button`, `Card`, `Tabs`, `Tag`, etc.) are imported directly from `@radix-ui/themes`.

## See Also

- [SPEC.md](./SPEC.md) — Full technical specification
- [router/README.md](./router/README.md) — Router details
