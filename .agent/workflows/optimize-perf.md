---
description: Profile and optimize rendering, queries, or bundle size
---

Optimize performance of the application.

## Bundle Analysis

```bash
# Analyze bundle size
BUNDLE_ANALYZE=true npm run build
```

## Code Splitting

```javascript
// Route-based (lazy loading)
import { lazy, Suspense } from 'react';
const Chart = lazy(() => import('./Chart'));

<Suspense fallback={<div>Loading...</div>}>
  <Chart />
</Suspense>;
```

## React Optimization

```javascript
// Memoize expensive components
import { memo, useMemo, useCallback } from 'react';

const ExpensiveList = memo(({ items }) => {
  const sorted = useMemo(
    () => items.sort((a, b) => a.value - b.value),
    [items],
  );
  return (
    <ul>
      {sorted.map(item => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
});

// Stable callbacks
const handleClick = useCallback(id => {
  console.log(id);
}, []);
```

## Database Optimization

```javascript
// Use indexes
indexes: [{ fields: ['userId'] }, { fields: ['slug'], unique: true }];

// Eager loading (avoid N+1)
const posts = await Post.findAll({
  include: [{ model: User, as: 'author' }],
});

// Select only needed fields
const users = await User.findAll({
  attributes: ['id', 'email'],
});

// Pagination
const { count, rows } = await Post.findAndCountAll({
  limit: 20,
  offset: 0,
});
```

## Server Optimization

```javascript
// Enable compression
import compression from 'compression';
app.use(compression());

// Cache static assets
app.use('/public', express.static('public', { maxAge: '1y' }));
```

## Images

```javascript
// Lazy loading
<img src="/image.jpg" loading="lazy" alt="..." />

// Responsive
<img
  srcSet="/img-400.jpg 400w, /img-800.jpg 800w"
  sizes="(max-width: 600px) 400px, 800px"
/>
```

## Checklist

- [ ] Enable code splitting
- [ ] Use React.memo, useMemo, useCallback
- [ ] Add database indexes
- [ ] Enable compression
- [ ] Set cache headers
- [ ] Lazy load images
- [ ] Debounce search inputs

## Worker Process Optimization

```javascript
// Offload heavy tasks to workers
import workerPool from '@shared/api/worker';

// Instead of blocking the request
export async function generateReport(req, res) {
  // ❌ Bad: Blocks the request
  const report = await heavyProcessing();
  res.json(report);
}

// ✅ Good: Dispatch to worker
export async function generateReport(req, res) {
  workerPool
    .sendRequest('report', 'GENERATE_REPORT', req.body)
    .catch(console.error);
  res.json({ message: 'Report generation started' });
}

// Configure worker pool concurrency
const workerPool = createWorkerPool(workersContext, {
  maxWorkers: 4, // Adjust based on CPU cores
});
```

## WebSocket Optimization

```javascript
// The @shared/ws server handles heartbeat automatically via config.heartbeatInterval
// Default: 30 seconds

// Throttle frequent channel broadcasts
import { throttle } from 'lodash';

const ws = app.get('container').resolve('ws');

const throttledBroadcast = throttle((type, data) => {
  ws.sendToPublicChannel(type, data);
}, 100); // Max 10 updates per second

// Use binary data for large payloads (if needed)
// Note: @shared/ws uses JSON by default, but you can send raw buffers via ws connection

// The server automatically cleans up inactive connections via heartbeat
// Connections that don't respond to ping are terminated
```

## Redux Optimization

```javascript
// Memoize selectors
import { createSelector } from '@reduxjs/toolkit';

const getUsers = state => state.users.items;
const getFilter = state => state.users.filter;

// ✅ Good: Memoized selector
export const getFilteredUsers = createSelector(
  [getUsers, getFilter],
  (users, filter) => users.filter(u => u.name.includes(filter)),
);

// Normalize state for large lists
const usersSlice = createSlice({
  name: 'users',
  initialState: {
    byId: {},
    allIds: [],
  },
  reducers: {
    setUsers: (state, action) => {
      state.byId = action.payload.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {});
      state.allIds = action.payload.map(u => u.id);
    },
  },
});

// Batch Redux updates
import { batch } from 'react-redux';

batch(() => {
  dispatch(action1());
  dispatch(action2());
  dispatch(action3());
});
```
