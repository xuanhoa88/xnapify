Optimize performance of the application.

## Bundle Analysis

```bash
# Analyze bundle size
BUNDLE_ANALYZE=true npm run build
```

## Code Splitting

```javascript
// Route-based (lazy loading)
import loadable from '@loadable/component';
const HeavyPage = loadable(() => import('./HeavyPage'));

// Component-based
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
