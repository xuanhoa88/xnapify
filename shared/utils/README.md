# Shared Utils

A collection of small, universal utility functions used across the React Starter Kit.

## Available Utilities

### `middleware.js` (`composeMiddleware`)

Composes an array of Express-style middleware functions (`(req, res, next) => void` or `(context, next) => void`) into a single executable function. 

- Flattens nested arrays automatically.
- Executes middlewares sequentially.
- Supports both synchronous and asynchronous (Promise-based) middlewares.
- Maintains standard error propagation via `next(err)`.

**Example:**
```javascript
import { composeMiddleware } from '@shared/utils/middleware';

const m1 = async (ctx, next) => {
  ctx.val = 1;
  await next();
};

const m2 = (ctx, next) => {
  ctx.val += 1;
  next();
};

const pipeline = composeMiddleware(m1, m2);
const context = {};
await pipeline(context);
console.log(context.val); // 2
```

### `contextAdapter.js` (`createWebpackContextAdapter`)

Creates an adapter over Webpack's `require.context` to provide a standardized, predictable interface for dynamically loading modules (e.g., auto-discovering extensions or Node-RED nodes).

- `files()`: Returns an array of matched file paths.
- `load(path)`: Requires and returns the specific module.
- `resolve(path)`: Returns the absolute resolved path.

**Example:**
```javascript
import { createWebpackContextAdapter } from '@shared/utils/contextAdapter';

// Retrieve all scripts matching the regex in the folder
const context = require.context('./scripts', false, /\.js$/);
const adapter = createWebpackContextAdapter(context);

adapter.files().forEach(filePath => {
    const mod = adapter.load(filePath);
    console.log("Loaded:", filePath, mod);
});
```

## See Also
- [SPEC.md](./SPEC.md) — Technical specification
