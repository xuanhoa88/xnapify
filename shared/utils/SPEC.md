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

## `contextAdapter.js` (`createWebpackContextAdapter`)

A wrapper function designed to decouple domain logic (like the `node-red` settings generator or `extension` loader) from Webpack's non-standard `require.context` API.

### Interface Mapping
- `adapter.files()` strictly maps to `ctx.keys()`.
- `adapter.load(path)` strictly maps to `ctx(path)`.
- `adapter.resolve(path)` strictly maps to `ctx.resolve(path)`.

This decoupling allows testing environments (like Jest) that mock `require.context` to operate cleanly under a standardized interface without needing to replicate internal Webpack hidden properties.
