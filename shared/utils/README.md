# Shared Utils

A collection of small, universal utility functions used across the xnapify.

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

### `contextAdapter.js` (`createRspackContextAdapter`)

Creates an adapter over Rspack's `import.meta.webpackContext` to provide a standardized, predictable interface for dynamically loading modules (e.g., auto-discovering extensions or Node-RED nodes).

- `files()`: Returns an array of matched file paths.
- `load(path)`: Requires and returns the specific module.
- `resolve(path)`: Returns the absolute resolved path.

**Example:**

```javascript
import { createRspackContextAdapter } from '@shared/utils/contextAdapter';

// Retrieve all scripts matching the regex in the folder
const context = import.meta.webpackContext('./scripts', {
  recursive: false,
  regExp: /\.js$/,
});
const adapter = createRspackContextAdapter(context);

adapter.files().forEach(filePath => {
  const mod = adapter.load(filePath);
  console.log('Loaded:', filePath, mod);
});
```

---

# Shared Utils — Technical Specification

## Overview

The `shared/utils/` directory acts as a dumping ground for highly reusable, pure, small-footprint functions that lack strong domain coupling to specific backend or frontend architectures.

## `middleware.js` (`composeMiddleware`)

An asynchronous middleware composer mirroring Koa's `koa-compose` logic but adapted specifically for generic argument spreading and Express-like `next(err)` error passing.

### Execution Guarantees

- **Type Safety**: Instantly throws `TypeError` if any provided argument (after infinite depth flattening via `Array.prototype.flat()`) is not a function.
- **Multiple Execution Guard**: Throws an Error ("next() called multiple times") if a single middleware function attempts to call `next()` more than once.
- **Promise Return**: Returns a native `Promise`. Catching `error` objects passed into `next(err)` triggers the returned Promise to reject with the given error.
- **Trailing Next Callback**: If the very last argument passed into the composed function invocation is a function, it treats it as the final trailing `next` callback (the terminus of the pipeline). All preceding arguments are treated as the pipeline `context` arguments.

## `contextAdapter.js` (`createRspackContextAdapter`)

A wrapper function designed to decouple domain logic (like the `node-red` settings generator or `extension` loader) from Rspack's non-standard `import.meta.webpackContext` API.

### Interface Mapping

- `adapter.files()` strictly maps to `ctx.keys()`.
- `adapter.load(path)` strictly maps to `ctx(path)`.
- `adapter.resolve(path)` strictly maps to `ctx.resolve(path)`.

This decoupling allows testing environments (like Jest) that mock `import.meta.webpackContext` to operate cleanly under a standardized interface without needing to replicate internal Rspack hidden properties.
