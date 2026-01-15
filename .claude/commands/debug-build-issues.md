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
- Restart dev server: `npm start`

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
LOG_LEVEL=debug npm start

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
