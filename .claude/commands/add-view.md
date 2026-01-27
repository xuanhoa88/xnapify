Add a new view/route to a module.

## Structure

```
src/modules/{module-name}/views/{view-path}/
├── _route.js         # Route definition (metadata, middleware, data fetching)
├── _layout.js        # Optional layout wrapper for this view
├── {ViewName}.js     # View component
├── {ViewName}.css    # CSS Modules styles
└── {ViewName}.test.js # Tests (optional)
```

## 1. Create View Component

```javascript
// src/modules/(default)/views/my-view/MyView.js
import React from 'react';
import PropTypes from 'prop-types';
import s from './MyView.css';

function MyView({ title }) {
  return (
    <div className={s.container}>
      <h1 className={s.title}>{title}</h1>
      <p>View content here</p>
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
/* src/modules/(default)/views/my-view/MyView.css */
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
// src/modules/(default)/views/my-view/_route.js
import MyView from './MyView';

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
import { Link } from '@/shared/renderer/components/History';

<Link to='/my-view'>My View</Link>;
```

## Route Configuration Options

### Layout Control

Use `export const layout` to control which layout wraps the view:

```javascript
// src/modules/(default)/views/login/_route.js
import Login from './Login';

// Disable layout wrapping entirely
export const layout = false;

export default Login;
```

### Middleware (Route Guards)

Use `export async function middleware` for authentication, authorization, or redirects:

```javascript
// src/modules/(default)/views/dashboard/_route.js
import { isAuthenticated } from '@/shared/renderer/redux';
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
src/modules/(default)/views/(layouts)/(admin)/
├── _layout.js        # Admin layout wrapper
├── Layout.css
├── Drawer/
│   └── index.js
└── Header/
    └── index.js
```

```javascript
// src/modules/(default)/views/(layouts)/(admin)/_layout.js
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
src/modules/users/views/admin/[id]/
├── _route.js
└── UserProfile.js
```

```javascript
// src/modules/users/views/admin/[id]/_route.js
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
src/modules/(default)/views/
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
// src/modules/(default)/views/admin/dashboard/_route.js
import { isAuthenticated, hasPermission } from '@/shared/renderer/redux';
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
