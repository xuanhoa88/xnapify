Add a new view/route to a module.

## Structure

```
src/modules/{module-name}/views/{view-path}/
├── _route.js         # Route definition (metadata, data fetching)
├── {ViewName}.js     # View component
├── {ViewName}.css    # CSS Modules styles
└── {ViewName}.test.js # Tests (optional)
```

## 1. Create View Component

```javascript
// src/modules/my-module/views/my-view/MyView.js
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
/* src/modules/my-module/views/my-view/MyView.css */
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
// src/modules/my-module/views/my-view/_route.js
import MyView from './MyView';

/**
 * Data Loading & Metadata (Server & Client)
 */
export async function getInitialProps({ fetch, store, i18n }) {
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
 * Default Export
 */
export default MyView;
```

## 4. Add Navigation Link

```javascript
import { Link } from '@/shared/renderer/components/History';

<Link to='/my-module/my-view'>My View</Link>;
```

## Dynamic Routes

Create a folder with brackets `[paramName]` or `(group)` for organization.

```
src/modules/users/views/[id]/
├── _route.js
└── UserProfile.js
```

```javascript
// src/modules/users/views/[id]/_route.js
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

## Protected Routes

Use middleware in `_route.js` (if supported) or handle in component/getInitialProps. Note: Strict middleware support in `_route.js` depends on your router implementation, but typically auth checks happen in `getInitialProps` or via Higher Order Components.

```javascript
// src/modules/admin/views/dashboard/_route.js
import Dashboard from './Dashboard';

export async function getInitialProps({ store, i18n }) {
  const state = store.getState();
  // Check auth state
  // if (!isAuthenticated(state)) return { redirect: '/login' };

  return {
    title: 'Dashboard',
  };
}

export default Dashboard;
```
