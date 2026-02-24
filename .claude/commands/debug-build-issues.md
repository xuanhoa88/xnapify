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
npm --version   # >= 8.0.0
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
// Server-side: Check WebSocket connections using the @shared/ws API
app.get('/api/ws-debug', (req, res) => {
  const ws = req.app.get('ws');
  if (!ws) {
    return res.status(500).json({ error: 'WebSocket server not initialized' });
  }

  // Use getStats() for server statistics
  const stats = ws.getStats();

  // Get connection details (ws.connections is a Map<connectionId, WebSocket>)
  const connections = [];
  ws.connections.forEach((conn, id) => {
    connections.push({
      id,
      authenticated: conn.authenticated,
      user: conn.user,
      connectedAt: conn.connectedAt,
    });
  });

  res.json({ stats, connections });
});

// Client-side: Debug connection
import { useWebSocket } from '@/shared/ws/client';

const ws = useWebSocket();
ws.on('connected', () => console.log('✅ WebSocket connected'));
ws.on('error', error => console.error('❌ WebSocket error:', error));
ws.on('disconnected', info => console.log('🔌 WebSocket disconnected:', info));

// Check client status
console.log('Status:', ws.getStatus());
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
const db = require('@/shared/api/db');
const { connection } = db;

const status = await db.getMigrationStatus(null, connection);
console.log('Executed migrations:', status.executed);

console.log('Pending migrations:', status.pending);

// Run migrations manually
await db.runMigrations(null, connection);

// Rollback last migration
await db.revertMigrations(null, connection);

// Check database connection
try {
  await connection.authenticate();
  console.log('✅ Database connected');
} catch (error) {
  console.error('❌ Database connection failed:', error);
}

// View database schema
const tables = await connection.getQueryInterface().showAllTables();
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
