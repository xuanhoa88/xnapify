---
description: Add a page route with lifecycle hooks to a module
---

Add a new view/route to a module.

## Structure

```
@apps/{module-name}/views/{view-path}/
├── _route.js         # Route definition (metadata, middleware, data fetching)
├── _layout.js        # Optional layout wrapper for this view
├── {ViewName}.js     # View component
├── {ViewName}.css    # CSS Modules styles
└── {ViewName}.test.js # Tests (optional)
```

## 1. Create View Component

> **Rule:** Never hardcode user-facing strings! Always use `useTranslation` and the `translations/en-US.json` file.

```javascript
// @apps/(default)/views/my-view/MyView.js
import React from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import s from './MyView.css';

function MyView({ title }) {
  const { t } = useTranslation('default'); // Use your module name

  return (
    <div className={s.container}>
      <h1 className={s.title}>{title}</h1>
      <p>{t('myView.content', 'View content here')}</p>
    </div>
  );
}

MyView.propTypes = {
  title: PropTypes.string.isRequired,
};

export default MyView;
```

## 2. Create Styles

```css
/* @apps/(default)/views/my-view/MyView.css */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.title {
  font-size: 2rem;
  font-weight: bold;
  margin-bottom: 1rem;
}
```

## 3. Create Route Definition

```javascript
// @apps/(default)/views/my-view/_route.js
import MyView from './MyView';

/**
 * Route-level lifecycle hooks (all optional):
 * - setup({ store, i18n })    — called once when route is discovered (register menus)
 * - init({ store })           — called once when route is first visited (inject reducers)
 * - mount({ store, i18n })    — called each time route is navigated to (breadcrumbs)
 * - unmount({ store })        — called each time route is navigated away
 * - teardown({ store })       — called once when route is cleaned up (unregister menus)
 * - middleware(context, next) — guard function, runs before rendering
 * - getInitialProps(context)  — data fetching for SSR and client
 */

/**
 * Data Loading & Metadata (Server & Client)
 */
export async function getInitialProps({ fetch, store, i18n, locale }) {
  // Fetch data if needed
  // const { data } = await fetch('/api/example');

  return {
    title: i18n.t('myView.title', 'My View'), // Page title
    description: 'Description for SEO',
    // props passed to component:
    // data: data
  };
}

/**
 * Default Export - Page component
 */
export default MyView;
```

## 4. Add Navigation Link

```javascript
import { Link } from '@shared/renderer/components/History';

<Link to='/my-view'>My View</Link>;
```

## 5. Forms & Data Entry

When building data entry views, settings panels, or forms, **always** use the unified `@shared/renderer/components/Form` system (built on `react-hook-form`) rather than building raw, custom controlled `<input>` elements or independent `useState` tracking.

```javascript
import Form, { useFormContext } from '@shared/renderer/components/Form';
import Button from '@shared/renderer/components/Button';

// 1. (Optional) Zod Schema Definition
const schema = ({ z, i18n }) => z.object({
  email: z.string().email(i18n.t('error.email', 'Invalid email')),
});

// 2. Context-Aware Submit Button
function SaveButton() {
  const { formState: { isDirty, isSubmitting } } = useFormContext();
  return (
    <Button type="submit" variant="primary" disabled={!isDirty || isSubmitting}>
      {isSubmitting ? 'Saving...' : 'Save Changes'}
    </Button>
  );
}

// 3. Wrap in Form Provider
function ProfileForm({ initialData }) {
  const handleSave = async (data, methods) => {
    // `data` contains fully validated form values
    // `methods.formState.dirtyFields` contains exclusively edited fields
    await apiCall(data);
  };

  return (
    <Form defaultValues={initialData} schema={schema} onSubmit={handleSave}>
      <Form.Input name="email" label="Email Address" />
      <Form.Password name="password" label="New Password" />
      <Form.Switch name="notifications" label="Enable Notifications" />
      <Form.Textarea name="bio" rows={4} />
      <SaveButton />
    </Form>
  );
}
```

> **Important:** If fetching unstructured keys with dots (like `namespace.key`), `react-hook-form` will inherently interpret dots as deeply nested objects (`{ namespace: { key: ... } }`). If parsing flat configurations, use an alternative join like `namespace___key` for the `name=` prop, then parse them apart during `onSubmit()`.

## Route Configuration Options

### Layout Control

Use `export const layout` to control which layout wraps the view:

```javascript
// @apps/(default)/views/login/_route.js
import Login from './Login';

// Disable layout wrapping entirely
export const layout = false;

export default Login;
```

### Middleware (Route Guards)

Use `export async function middleware` for authentication, authorization, or redirects:

```javascript
// @apps/(default)/views/dashboard/_route.js
import { features } from '@shared/renderer/redux';

const { isAuthenticated } = features;
import Dashboard from './Dashboard';

/**
 * Guard function - runs before rendering
 */
export async function middleware(context, next) {
  const { store } = context;
  const state = store.getState();

  // Redirect unauthenticated users
  if (!isAuthenticated(state)) {
    return { redirect: '/login' };
  }

  // Continue to next middleware or render
  return next();
}

export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('dashboard.title', 'Dashboard'),
  };
}

export default Dashboard;
```

## Layout Files (`_layout.js`)

Create `_layout.js` in a view directory to wrap views with a layout component:

```
@apps/(default)/views/(layouts)/(admin)/
├── _layout.js        # Admin layout wrapper
├── Layout.css
├── Drawer/
│   └── index.js
└── Header/
    └── index.js
```

```javascript
// @apps/(default)/views/(layouts)/(admin)/_layout.js
import PropTypes from 'prop-types';
import Header from './Header';
import Drawer from './Drawer';
import s from './Layout.css';

function AdminLayout({ children }) {
  return (
    <div className={s.root}>
      <Header />
      <div className={s.container}>
        <Drawer />
        <main className={s.content}>{children}</main>
      </div>
    </div>
  );
}

AdminLayout.propTypes = {
  children: PropTypes.node,
};

export default AdminLayout;
```

## Dynamic Routes

Create a folder with brackets `[paramName]` for dynamic segments or `(group)` for organization:

```
@apps/users/views/(admin)/[id]/
├── _route.js
└── UserProfile.js
```

```javascript
// @apps/users/views/(admin)/[id]/_route.js
import UserProfile from './UserProfile';

export async function getInitialProps({ fetch, params }) {
  const { id } = params;
  const { data: user } = await fetch(`/api/users/${id}`);

  return {
    title: user.name,
    user,
  };
}

export default UserProfile;
```

## Route Groups

Use parentheses `(groupName)` to organize routes without affecting the URL path:

```
@apps/(default)/views/
├── (layouts)/          # Layout group (not in URL)
│   ├── (admin)/        # Admin layout
│   └── (default)/      # Default layout
├── (routes)/           # Route organization group
├── about/              # /about
├── login/              # /login
└── admin/
    └── dashboard/      # /admin/dashboard
```

## Protected Routes Example

```javascript
// @apps/(default)/views/(admin)/dashboard/_route.js
import { features } from '@shared/renderer/redux';

const { isAuthenticated, hasPermission } = features;
import Dashboard from './Dashboard';

export async function middleware(context, next) {
  const { store } = context;
  const state = store.getState();

  if (!isAuthenticated(state)) {
    return { redirect: '/login?returnTo=/admin/dashboard' };
  }

  if (!hasPermission(state, 'admin.dashboard.view')) {
    return { redirect: '/not-found' };
  }

  return next();
}

export async function getInitialProps({ i18n }) {
  return {
    title: i18n.t('admin.dashboard', 'Dashboard'),
  };
}

export default Dashboard;
```

## Standalone Components

When creating a reusable component (not a page route), use this pattern:

```
@apps/{module-name}/views/{view-path}/
├── {ComponentName}/
│   ├── index.js              # Re-export
│   ├── {ComponentName}.js    # Component
│   └── {ComponentName}.css   # CSS Modules styles
```

```javascript
// {ComponentName}.js
import React from 'react';
import PropTypes from 'prop-types';
import s from './{ComponentName}.css';

function {ComponentName}({ title, children }) {
  return (
    <div className={s.root}>
      <h2 className={s.title}>{title}</h2>
      {children}
    </div>
  );
}

{ComponentName}.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
};

export default {ComponentName};
```

### PropTypes Quick Reference

| Type | Usage |
|------|-------|
| `PropTypes.string` | String value |
| `PropTypes.number` | Number value |
| `PropTypes.bool` | Boolean value |
| `PropTypes.func` | Function/callback |
| `PropTypes.node` | Renderable content |
| `PropTypes.element` | React element |
| `PropTypes.object` | Object (prefer `shape`) |
| `PropTypes.array` | Array (prefer `arrayOf`) |
| `PropTypes.shape({...})` | Object with specific shape |
| `PropTypes.arrayOf(Type)` | Array of specific type |
| `PropTypes.oneOf([...])` | Enum values |
| `PropTypes.oneOfType([...])` | Union types |

Append `.isRequired` to make any prop mandatory.

---

## See Also

- `/add-module` — Full-stack module with API, views, models, and auto-discovery
- `/add-redux` — Redux Toolkit slice, thunks, and selectors for the view
- `/add-test` — Jest tests for view components
- `/add-extension` — Extension views with slots and hooks
- `/modify` — Modify existing views with test verification
