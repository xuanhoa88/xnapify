Optimize performance of the React Starter Kit application:

## Bundle Optimization

### 1. Analyze Bundle Size

```bash
# Build with bundle analyzer
BUILD_ANALYZE=true npm run build

# Open analyzer in browser
open build/bundle-stats.html
```

**What to look for:**

- Large dependencies (>100KB)
- Duplicate dependencies
- Unused code
- Opportunities for code splitting

### 2. Enable Code Splitting

**Route-based splitting (already implemented):**

```javascript
// src/routes/heavy-page/index.js
export default {
  path: '/heavy-page',

  async action() {
    // Dynamic import for code splitting
    const HeavyPage = await import('./HeavyPage');

    return {
      title: 'Heavy Page',
      component: <HeavyPage.default />,
    };
  },
};
```

**Component-based splitting:**

```javascript
import React, { lazy, Suspense } from 'react';

// Lazy load heavy component
const HeavyChart = lazy(() => import('./HeavyChart'));

function Dashboard() {
  return (
    <Suspense fallback={<div>Loading chart...</div>}>
      <HeavyChart />
    </Suspense>
  );
}
```

### 3. Tree Shaking

**Use named imports:**

```javascript
// ❌ Bad - imports entire library
import _ from 'lodash';
const result = _.debounce(fn, 100);

// ✅ Good - imports only what's needed
import debounce from 'lodash/debounce';
const result = debounce(fn, 100);

// ✅ Even better - use native or smaller alternatives
import debounce from 'lodash-es/debounce';
```

**Configure webpack for better tree shaking:**

```javascript
// tools/webpack/client.js
optimization: {
  usedExports: true,
  sideEffects: false,
}
```

### 4. Minimize Dependencies

**Replace large libraries with smaller alternatives:**

```bash
# Replace moment.js (288KB) with date-fns (78KB)
npm uninstall moment
npm install date-fns

# Replace lodash (71KB) with lodash-es (24KB) or native methods
npm install lodash-es

# Use native Intl API instead of i18n libraries where possible
```

### 5. Enable Compression

**Add gzip/brotli compression:**

```javascript
// src/server.js
import compression from 'compression';

app.use(
  compression({
    level: 6, // Compression level (0-9)
    threshold: 1024, // Only compress files > 1KB
    filter: (req, res) => {
      // Don't compress if client doesn't support it
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
  }),
);
```

## React Performance

### 1. Memoization

**Use React.memo for expensive components:**

```javascript
import React, { memo } from 'react';

const ExpensiveComponent = memo(
  ({ data }) => {
    // Expensive rendering logic
    return <div>{/* ... */}</div>;
  },
  (prevProps, nextProps) => {
    // Custom comparison function
    return prevProps.data.id === nextProps.data.id;
  },
);
```

**Use useMemo for expensive calculations:**

```javascript
import { useMemo } from 'react';

function DataTable({ data }) {
  const sortedData = useMemo(() => {
    return data.sort((a, b) => a.value - b.value);
  }, [data]); // Only recalculate when data changes

  return <table>{/* render sortedData */}</table>;
}
```

**Use useCallback for stable function references:**

```javascript
import { useCallback } from 'react';

function Parent() {
  const handleClick = useCallback(id => {
    console.log('Clicked:', id);
  }, []); // Function never changes

  return <Child onClick={handleClick} />;
}
```

### 2. Virtualization for Long Lists

**Install react-window:**

```bash
npm install react-window
```

**Use for long lists:**

```javascript
import { FixedSizeList } from 'react-window';

function LongList({ items }) {
  const Row = ({ index, style }) => (
    <div style={style}>{items[index].name}</div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={items.length}
      itemSize={50}
      width='100%'
    >
      {Row}
    </FixedSizeList>
  );
}
```

### 3. Lazy Loading Images

```javascript
import React, { useState, useEffect, useRef } from 'react';

function LazyImage({ src, alt, placeholder }) {
  const [imageSrc, setImageSrc] = useState(placeholder);
  const imgRef = useRef();

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setImageSrc(src);
          observer.disconnect();
        }
      });
    });

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [src]);

  return <img ref={imgRef} src={imageSrc} alt={alt} />;
}
```

### 4. Debounce Expensive Operations

```javascript
import { useState, useCallback } from 'react';
import debounce from 'lodash/debounce';

function SearchInput() {
  const [results, setResults] = useState([]);

  const search = useCallback(
    debounce(async query => {
      const data = await fetch(`/api/search?q=${query}`);
      setResults(data);
    }, 300),
    [],
  );

  return (
    <input
      type='text'
      onChange={e => search(e.target.value)}
      placeholder='Search...'
    />
  );
}
```

## Server-Side Optimization

### 1. Enable Caching Headers

```javascript
// src/server.js
app.use(
  '/public',
  express.static('public', {
    maxAge: '1y', // Cache static assets for 1 year
    immutable: true,
  }),
);

// Cache API responses
app.get('/api/data', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5 minutes
  res.json(data);
});
```

### 2. Database Query Optimization

**Add indexes:**

```javascript
// src/data/models/Post.js
{
  indexes: [
    { fields: ['userId'] },
    { fields: ['published', 'publishedAt'] },
    { fields: ['slug'], unique: true },
  ],
}
```

**Use eager loading:**

```javascript
// ❌ Bad - N+1 query problem
const posts = await Post.findAll();
for (const post of posts) {
  const author = await User.findByPk(post.userId); // N queries
}

// ✅ Good - Single query with JOIN
const posts = await Post.findAll({
  include: [{ model: User, as: 'author' }],
});
```

**Limit fields:**

```javascript
// Only fetch needed fields
const users = await User.findAll({
  attributes: ['id', 'display_name', 'email'],
});
```

**Use pagination:**

```javascript
const page = parseInt(req.query.page) || 1;
const limit = 20;
const offset = (page - 1) * limit;

const { count, rows } = await Post.findAndCountAll({
  limit,
  offset,
  order: [['createdAt', 'DESC']],
});
```

### 3. Response Compression

```bash
npm install compression
```

```javascript
import compression from 'compression';

app.use(
  compression({
    level: 6,
    threshold: 1024,
  }),
);
```

### 4. HTTP/2 Server Push

```javascript
// Push critical resources
app.get('/', (req, res) => {
  if (res.push) {
    res.push('/main.css', {
      response: { 'content-type': 'text/css' },
    });
    res.push('/main.js', {
      response: { 'content-type': 'application/javascript' },
    });
  }

  res.render('index');
});
```

## Build Optimization

### 1. Parallel Builds

```bash
# Enable parallel builds
BUILD_PARALLEL=true npm run build
```

### 2. Webpack Caching

```javascript
// tools/webpack/client.js
cache: {
  type: 'filesystem',
  cacheDirectory: path.resolve(__dirname, '../../.webpack-cache'),
  buildDependencies: {
    config: [__filename],
  },
}
```

### 3. Production Optimizations

**Enable in webpack config:**

```javascript
optimization: {
  minimize: true,
  minimizer: [
    new TerserPlugin({
      terserOptions: {
        compress: {
          drop_console: true, // Remove console.log in production
        },
      },
    }),
  ],
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        priority: 10,
      },
      common: {
        minChunks: 2,
        priority: 5,
        reuseExistingChunk: true,
      },
    },
  },
}
```

## CSS Optimization

### 1. Critical CSS

**Extract critical CSS for above-the-fold content:**

```javascript
// Already implemented in src/components/Html.js
<style dangerouslySetInnerHTML={{ __html: css.join('') }} />
```

### 2. Remove Unused CSS

```bash
npm install --save-dev purgecss-webpack-plugin
```

```javascript
// tools/webpack/client.js
import PurgeCSSPlugin from 'purgecss-webpack-plugin';
import glob from 'glob';

plugins: [
  new PurgeCSSPlugin({
    paths: glob.sync('src/**/*', { nodir: true }),
  }),
];
```

### 3. CSS Minification

**Already enabled via css-loader:**

```javascript
{
  loader: 'css-loader',
  options: {
    minimize: !isDebug,
  },
}
```

## Image Optimization

### 1. Use Modern Formats

```javascript
// Use WebP with fallback
<picture>
  <source srcSet='/image.webp' type='image/webp' />
  <img src='/image.jpg' alt='Description' />
</picture>
```

### 2. Responsive Images

```javascript
<img
  src='/image-800.jpg'
  srcSet='
    /image-400.jpg 400w,
    /image-800.jpg 800w,
    /image-1200.jpg 1200w
  '
  sizes='(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px'
  alt='Description'
/>
```

### 3. Lazy Loading

```javascript
<img src='/image.jpg' loading='lazy' alt='Description' />
```

## Monitoring Performance

### 1. Enable Performance Monitoring

```javascript
// src/client.js
if (process.env.NODE_ENV === 'production') {
  // Log performance metrics
  window.addEventListener('load', () => {
    const perfData = window.performance.timing;
    const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
    console.log('Page load time:', pageLoadTime);
  });
}
```

### 2. Use Lighthouse

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run audit
lighthouse http://localhost:3000 --view
```

### 3. Monitor Bundle Size

```bash
# Check bundle size after each build
npm run build

# Set up size budget in webpack
performance: {
  maxEntrypointSize: 250000, // 250KB
  maxAssetSize: 250000,
  hints: 'warning',
}
```

## Performance Checklist

### Build Time

- [ ] Enable webpack caching
- [ ] Use parallel builds
- [ ] Minimize source maps in production
- [ ] Remove unused dependencies

### Bundle Size

- [ ] Enable code splitting
- [ ] Use tree shaking
- [ ] Minimize dependencies
- [ ] Enable compression
- [ ] Remove console.log in production

### Runtime Performance

- [ ] Use React.memo for expensive components
- [ ] Use useMemo for expensive calculations
- [ ] Use useCallback for stable functions
- [ ] Virtualize long lists
- [ ] Lazy load images
- [ ] Debounce expensive operations

### Server Performance

- [ ] Enable caching headers
- [ ] Optimize database queries
- [ ] Add database indexes
- [ ] Use pagination
- [ ] Enable compression
- [ ] Use HTTP/2

### CSS Performance

- [ ] Extract critical CSS
- [ ] Remove unused CSS
- [ ] Minify CSS
- [ ] Use CSS Modules

### Image Performance

- [ ] Use modern formats (WebP)
- [ ] Use responsive images
- [ ] Lazy load images
- [ ] Optimize image sizes

## Useful Commands

```bash
# Analyze bundle
BUILD_ANALYZE=true npm run build

# Profile build
BUILD_PROFILE=true npm run build

# Check bundle size
npm run build && du -sh build/public/*.js

# Run Lighthouse audit
lighthouse http://localhost:3000 --view

# Check performance in production
NODE_ENV=production npm start
```
