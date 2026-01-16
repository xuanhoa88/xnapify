Debug common build and runtime issues.

## Quick Fixes

```bash
# Clean rebuild (fixes most issues)
npm run clean && rm -rf node_modules package-lock.json && npm install

# Clear webpack cache
rm -rf node_modules/.cache

# Kill port 1337 if in use
npx kill-port -p 1337
```

## Build Issues

### Module not found

```bash
rm -rf node_modules package-lock.json
npm install
```

### Heap out of memory

```bash
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### CSS/Babel errors

```bash
# Reinstall loaders
npm install --save-dev babel-loader css-loader
```

## Runtime Issues

### HMR not working

- Check browser console for `[HMR] connected`
- Restart dev server: `npm run dev`

### SSR hydration mismatch

```javascript
// Use useEffect for browser-only code
useEffect(() => {
  window.addEventListener('scroll', handler);
  return () => window.removeEventListener('scroll', handler);
}, []);
```

### CSS not loading

```javascript
// Ensure CSS is imported
import s from './Component.css';

function Component() {
  return <div className={s.container}>...</div>;
}
```

### Redux state not updating

- Check Provider wraps app
- Verify reducer returns new object
- Use Redux DevTools to debug

### Auth issues (401 errors)

```javascript
// Server-side: Check if cookie is received
app.use((req, res, next) => {
  console.log('Cookies:', req.cookies);
  console.log('User:', req.user);
  next();
});

// Check token via API endpoint
// GET /api/auth/me - returns current user or 401
```

**Note:** Cookies are `httpOnly` and `secure`, so they can't be accessed via `document.cookie` in browser.

## Debugging

```bash
# Verbose logging
LOG_LEVEL=debug npm run dev

# Check versions
node --version  # >= 16.0.0
npm --version   # >= 7.0.0
```

### VS Code Debugger

Use preconfigured launch configurations:

1. Open VS Code Command Palette (`Cmd+Shift+P`)
2. Select **Debug: Select and Start Debugging**
3. Choose:
   - **RSK: Start Dev Server** - Debug development server
   - **RSK: Run Tests** - Debug tests

## Common Errors

| Error                | Fix                     |
| -------------------- | ----------------------- |
| `Cannot find module` | `npm install`           |
| `Port 1337 in use`   | `npx kill-port -p 1337` |
| `ENOSPC` (Linux)     | Increase file watchers  |

## WebSocket Debugging

```javascript
// Server-side: Check WebSocket connections
app.get('/wss', (req, res) => {
  const wss = req.app.get('wss');
  res.json({
    clients: wss.clients.size,
    connections: Array.from(wss.clients).map(ws => ({
      readyState: ws.readyState,
      user: ws.userId,
    })),
  });
});

// Client-side: Debug connection
const ws = createWebSocketClient();
ws.on('connected', () => console.log('✅ WebSocket connected'));
ws.on('error', (error) => console.error('❌ WebSocket error:', error));
ws.on('disconnected', () => console.log('🔌 WebSocket disconnected'));

// Test with wscat
npm install -g wscat
wscat -c ws://localhost:1337/ws?token=YOUR_TOKEN
```

## RBAC/Permissions Debugging

```javascript
// Check user permissions
GET /api/users/:id/permissions

// Check if user has specific permission
const auth = req.app.get('auth');
const hasPermission = await auth.helpers.hasPermission(userId, 'posts:update');
console.log('Has permission:', hasPermission);

// Check user roles
const roles = await auth.helpers.getUserRoles(userId);
console.log('User roles:', roles);

// Debug middleware
app.use((req, res, next) => {
  console.log('User:', req.user);
  console.log('Permissions:', req.user?.permissions);
  next();
});
```

## JWT Token Debugging

```javascript
// Server-side: Verify token manually
const jwt = req.app.get('auth').jwt;
try {
  const decoded = jwt.verify(token);
  console.log('Token payload:', decoded);
} catch (error) {
  console.error('Token verification failed:', error.message);
}

// Check token expiration
const decoded = jwt.decode(token);
const expiresAt = new Date(decoded.exp * 1000);
console.log('Token expires at:', expiresAt);
console.log('Is expired:', Date.now() > decoded.exp * 1000);

// Client-side: Check cookie
// Note: JWT is httpOnly, can't access via document.cookie
// Use API endpoint instead
fetch('/api/auth/me')
  .then(res => res.json())
  .then(data => console.log('Current user:', data))
  .catch(err => console.error('Not authenticated:', err));
```

## Database Migration Debugging

```javascript
// Check migration status
const db = require('@/api/engines/db').default;
const migrations = await db.umzug.executed();
console.log(
  'Executed migrations:',
  migrations.map(m => m.name),
);

const pending = await db.umzug.pending();
console.log(
  'Pending migrations:',
  pending.map(m => m.name),
);

// Run migrations manually
await db.umzug.up();

// Rollback last migration
await db.umzug.down();

// Check database connection
try {
  await db.connection.authenticate();
  console.log('✅ Database connected');
} catch (error) {
  console.error('❌ Database connection failed:', error);
}

// View database schema
const tables = await db.connection.getQueryInterface().showAllTables();
console.log('Tables:', tables);
```

## Redux DevTools

```javascript
// Enable Redux DevTools in development
// Already configured in configureStore.js

// Time-travel debugging
// 1. Open Redux DevTools in browser
// 2. Click on actions to see state changes
// 3. Use slider to time-travel through state

// Export/Import state
// 1. Click "Export" to save state
// 2. Click "Import" to load saved state
```
