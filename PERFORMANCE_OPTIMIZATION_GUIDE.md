## Performance Optimization Implementation Guide

This guide provides step-by-step instructions for implementing the Priority 1 optimizations.

---

## 1. JWT Verification Cache

**File:** `src/shared/api/auth/index.js`  
**Effort:** 30 minutes  
**Impact:** 80% skip rate on verified tokens (saves ~0.4ms per request)

### Implementation

```javascript
// Add at top of auth module
class JWTCache {
  constructor(ttlMs = 60000) { // 60 second TTL
    this.cache = new Map();
    this.ttl = ttlMs;
  }

  set(token, decoded) {
    this.cache.set(token, {
      data: decoded,
      exp: Date.now() + this.ttl,
    });
  }

  get(token) {
    const entry = this.cache.get(token);
    if (!entry) return null;
    if (entry.exp < Date.now()) {
      this.cache.delete(token); // Clean expired entries
      return null;
    }
    return entry.data;
  }

  clear() {
    this.cache.clear();
  }
}

const jwtCache = new JWTCache(60000); // 60s cache TTL

// Modify requireAuth middleware
export function requireAuth(req, res, next) {
  const token = extractToken(req); // from cookies or header
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  // Check cache first
  const cached = jwtCache.get(token);
  if (cached) {
    req.user = cached;
    return next();
  }

  // Verify token
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    jwtCache.set(token, decoded);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Add cache clear on logout
export function logout(req, res) {
  const token = extractToken(req);
  jwtCache.delete(token); // Clear from cache
  res.clearCookie('auth');
  res.json({ success: true });
}
```

**Testing:**
```bash
# Before
time curl http://localhost:1337/api/protected -H "Cookie: jwt=..." # ~1.2ms

# After (cached)
time curl http://localhost:1337/api/protected -H "Cookie: jwt=..." # ~0.3ms
```

---

## 2. Parallel RBAC Lookup

**File:** `src/apps/users/api/utils/rbac/fetcher.js`  
**Effort:** 15 minutes  
**Impact:** 40–50% reduction in auth latency (50–100ms → 20–30ms)

### Current Implementation (Sequential)
```javascript
async function fetchUserWithRBAC(userId) {
  const user = await User.findById(userId);      // 10ms
  const roles = await user.getRoles();           // 20ms
  const groups = await user.getGroups();         // 20ms
  const permissions = await getPermissions(...); // 30ms
  // Total: ~80ms
}
```

### Optimized Implementation (Parallel)
```javascript
async function fetchUserWithRBAC(userId) {
  const user = await User.findById(userId); // 10ms (must be first to get user ID)

  // Fetch roles, groups, permissions in parallel
  const [roles, groups, permissions] = await Promise.all([
    user.getRoles(),           // 20ms
    user.getGroups(),          // 20ms
    getPermissions(userId),    // 30ms
  ]).catch(err => {
    console.error('RBAC fetch error:', err);
    throw err;
  });

  // Total: ~10ms + ~30ms (max of parallel) = ~40ms
  return { user, roles, groups, permissions };
}
```

**Testing:**
```bash
# Test auth endpoint
time curl http://localhost:1337/api/auth/me \
  -H "Cookie: jwt=..." \
  -H "Accept: application/json"

# Should see ~50% latency reduction for first auth request
# (subsequent requests hit JWT cache from step 1)
```

---

## 3. Static Files After API Routes

**File:** `src/server.js` (around line 920)  
**Effort:** 10 minutes  
**Impact:** 1–2ms savings on every API request

### Current Order (WRONG)
```javascript
// Middleware order ~line 920–950
app.use(compression());
app.use(securityHeaders);
app.use(express.json());
app.use(locale);
app.use(express.static(path.join(__dirname, '../public'))); // ← TOO EARLY
app.use(timeout);
app.use(rateLimit);
app.use('/api', apiRouter); // ← API calls still stat() files
```

**Problem:** Every API request calls `fs.stat()` for public files (Chromebooks favicon requests, etc.)

### Optimized Order
```javascript
// Middleware order - reordered
app.use(compression());
app.use(securityHeaders);
app.use(express.json());
app.use(locale);
app.use(timeout);
app.use(rateLimit);
app.use('/api', apiRouter); // ← API routes first, skip stat() overhead
app.use(express.static(path.join(__dirname, '../public'))); // ← Static at end
```

### Alternative: Bloom Filter Skip
```javascript
// Skip static middleware for known API paths
const apiPathPattern = /^\/api\//;
app.use((req, res, next) => {
  if (apiPathPattern.test(req.path)) {
    return next(); // Skip static file check
  }
  express.static(path.join(__dirname, '../public'))(req, res, next);
});
```

---

## 4. Locale Detection Caching

**File:** `src/server.js` (locale middleware) or `src/shared/i18n/index.js`  
**Effort:** 20 minutes  
**Impact:** 0.2ms savings on cached requests

### Current Implementation
```javascript
// Every request parses locale
const localeMiddleware = (req, res, next) => {
  req.locale = req.language || config.DEFAULT_LOCALE; // ← re-parsed each time
  next();
};
```

### Optimized with Caching
```javascript
class LocaleCache {
  constructor(ttlMs = 300000) { // 5 minute cache
    this.cache = new Map();
    this.ttl = ttlMs;
  }

  getKey(req) {
    // Cache key from cookie + accept-language header
    return `${req.cookies?.locale || ''}|${req.get('accept-language') || ''}`;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.exp < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.locale;
  }

  set(key, locale) {
    this.cache.set(key, {
      locale,
      exp: Date.now() + this.ttl,
    });
  }
}

const localeCache = new LocaleCache();

const localeMiddleware = (req, res, next) => {
  const cacheKey = localeCache.getKey(req);
  
  // Try cache first
  const cached = localeCache.get(cacheKey);
  if (cached) {
    req.locale = cached;
    return next();
  }

  // Parse locale (expensive regex, etc.)
  const locale = parseLocale(req) || config.DEFAULT_LOCALE;
  
  // Cache result
  localeCache.set(cacheKey, locale);
  req.locale = locale;
  next();
};

app.use(localeMiddleware);
```

---

## 5. Request ID Optimization

**File:** `src/server.js` (around line 910)  
**Effort:** 5 minutes  
**Impact:** 0.05ms per request

### Current Implementation (SLOW)
```javascript
app.use((req, res, next) => {
  req.id = crypto.randomUUID(); // ← ~0.1ms per call
  next();
});
```

### Optimized
```javascript
// Fast random ID using simpler RNG
app.use((req, res, next) => {
  // Math.random() is faster than crypto.randomUUID()
  // Sufficient for request correlation, not security
  req.id = Math.random().toString(36).slice(2, 11); // 9 char base36 ID
  next();
});

// Or use a counter for even faster IDs
let requestCounter = 0;
const requestIdPrefix = Date.now().toString(36);

app.use((req, res, next) => {
  req.id = `${requestIdPrefix}-${(++requestCounter).toString(36)}`; // ~0.001ms
  next();
});
```

---

## 6. Express.json Performance

**File:** `src/server.js`  
**Effort:** 2 minutes  
**Impact:** Minor (already optimized)

### Current (Good)
```javascript
app.use(express.json({ limit: '10mb' }));
```

### Optimized (Slightly Better)
```javascript
app.use(express.json({
  limit: '1mb', // Reasonable for APIs
  strict: true, // Reject non-JSON
  type: 'application/json', // Skip parsing for other types
}));

// For larger payloads, use streaming
app.use(express.raw({ type: 'application/octet-stream', limit: '100mb' }));
```

---

## 7. Compression Threshold Tuning

**File:** `src/server.js`  
**Effort:** 5 minutes  
**Impact:** 5–10% reduction in response size

### Current
```javascript
app.use(compression({
  level: 6, // Default
  threshold: 1024, // Only compress > 1KB
}));
```

### Optimized for Different Environments
```javascript
const compressionLevel = process.env.NODE_ENV === 'production' ? 7 : 6;
const compressionThreshold = process.env.NODE_ENV === 'production' ? 2048 : 1024;

app.use(compression({
  level: compressionLevel,
  threshold: compressionThreshold,
  type: [
    'application/javascript',
    'application/json',
    'text/html',
    'text/plain',
    'text/css',
    'text/xml', // SVG
    'application/xml',
  ],
}));
```

---

## Implementation Checklist

- [ ] **JWT Cache** — 30 min
  - [ ] Create JWTCache class
  - [ ] Modify `requireAuth` middleware
  - [ ] Add cache invalidation on logout
  - [ ] Test with curl
  - [ ] Verify no stale user data issues

- [ ] **Parallel RBAC** — 15 min
  - [ ] Modify fetcher to use `Promise.all()`
  - [ ] Add error handling
  - [ ] Test auth endpoint
  - [ ] Verify RBAC still works correctly

- [ ] **Static Files** — 10 min
  - [ ] Reorder middleware in server.js
  - [ ] Test `/api` endpoints (fast)
  - [ ] Test `/public` endpoints (still work)
  - [ ] No regression

- [ ] **Locale Cache** — 20 min
  - [ ] Create LocaleCache class
  - [ ] Integrate with middleware
  - [ ] Test i18n switching still works
  - [ ] Clear cache on config change

- [ ] **Request IDs** — 5 min
  - [ ] Switch to Math.random() or counter
  - [ ] Ensure logging still works
  - [ ] Verify performance gain

- [ ] **Compression Tuning** — 5 min
  - [ ] Update compression config
  - [ ] Test response sizes (gzip analysis)
  - [ ] Monitor CPU usage

---

## Testing & Validation

### Performance Regression Tests
```bash
# Before optimization
npm run benchmark
# Note down baseline scores

# Apply optimizations
git commit -m "Performance: Priority 1 optimizations"

# After optimization
npm run benchmark
# Compare scores - should see 15-20% improvement
```

### Load Testing
```bash
# HTTP benchmark with new optimizations
BENCH_HANDLERS=10 BENCH_REQUESTS=2000 BENCH_CONCURRENCY=500 \
  node tools/bench/plugin-ipc-prod.runner.js

# Should see improved throughput (>1400 req/s)
```

### Stability Checks
```bash
# 1. Run full test suite
npm run test

# 2. Manual auth flow
curl http://localhost:1337/api/auth/login -X POST
curl http://localhost:1337/api/auth/me -H "Cookie: jwt=..."

# 3. Locale switching
curl http://localhost:1337/ -H "Accept-Language: es-ES"
curl http://localhost:1337/?locale=fr

# 4. SSR rendering (should display correctly)
curl http://localhost:1337/ | grep "<title>"
```

---

## Expected Results

After implementing all Priority 1 optimizations:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Unauth request | 2.5ms | 2.4ms | 4% |
| Auth request (cold) | 52ms | 42ms | 19% |
| Auth request (cached) | 2.5ms | 0.8ms | 68% |
| API throughput | 1,290 req/s | 1,500 req/s | 16% |
| p99 latency | 50ms | 35ms | 30% |

---

## Next Steps

After Priority 1 is complete and tested:
1. Measure actual improvements with monitoring
2. Plan Priority 2 (parallel hooks, SSR caching, etc.)
3. Consider dedicated performance role in team
4. Set up continuous benchmarking in CI
