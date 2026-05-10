# Shared Container

Lightweight, isomorphic Dependency Injection (DI) container.
Works identically on both client (browser) and server (Node.js) using standard ES features without platform-specific APIs.

## Quick Start

```javascript
// Register a factory (new object each time)
container.bind('logger', () => new Logger());

// Register a singleton (created once)
container.singleton('db', () => createConnection());

// Register a pre-built value
container.instance('config', { debug: true });

// Resolve
const logger = container.resolve('logger');
const db = container.resolve('db'); // same instance every time
const cfg = container.make('config'); // alias for resolve
```

## Features

- **Factory Bindings**: Fresh instance on every `resolve()` call. Use `.bind()` or `.factory()`.
- **Singleton Bindings**: Resolved once, then cached. Use `.singleton()`.
- **Instance Bindings**: Store pre-built values directly. Use `.instance()`.
- **Isomorphic**: Works everywhere.
- **Isolated Containers**: Create a fresh, independent instance for isolated use-cases:
  ```javascript
  import { createFactory } from '@shared/container';
  const myContainer = createFactory();
  ```

## Persistent Bindings (Ownership Key)

Any registration method accepts an optional `ownerKey` (any truthy value). Only the holder of the same key can overwrite or remove the binding, providing protection against accidental overwrites by other modules.

```javascript
const MY_KEY = Symbol('core-module');
container.bind('core:auth', () => authService, MY_KEY);

// Another module tries to overwrite — throws PersistentBindingError
container.bind('core:auth', () => evilService);

// reset() also requires the key
container.reset('core:auth', MY_KEY);
```

---

# Shared Container — Technical Specification

## Overview

The `shared/container/` provides an isomorphic Dependency Injection container utilized across both server (`@shared/api`) and client (`@shared/renderer`) architecture to tie modules together, map dependencies, and control lifecycles.

## Architecture

```
shared/container/
├── index.js          # Export default singleton container and createFactory helper
└── Container.js      # Core container class implementation
```

## Internal Mechanics

The `Container` class utilizes an ES6 `Map` to store its bindings using a private symbol key:

```javascript
const BINDINGS = Symbol('__xnapify.containerBindings__');

class Container {
  constructor() {
    this[BINDINGS] = new Map();
  }
}
```

### Binding Record Shape

Each entry in the map has the following shape:

| Property     | Type       | Description                                             |
| ------------ | ---------- | ------------------------------------------------------- |
| `type`       | `string`   | Resolving strategy (`factory`, `singleton`, `instance`) |
| `factory`    | `Function` | (Optional) Function to generate the value               |
| `value`      | `*`        | (Optional) Cached outcome or direct instance            |
| `resolved`   | `boolean`  | (Singletons only) True if resolved                      |
| `persistent` | `*`        | Developer provided `ownerKey` or `false`                |

### Resolution Strategies

- **`INSTANCE` (`container.instance()`)**: Returns the `value` directly.
- **`SINGLETON` (`container.singleton()`)**: If `resolved: false`, it executes `factory(this)` passing the container instance as an argument, caches the result in `value`, marks `resolved: true`, and returns `value`. Otherwise, returns cached `value`.
- **`FACTORY` (`container.bind()`, `container.factory()`)**: Executes `factory(this)` and returns the new value every time.

_(The container reference `this` is passed to every factory invocation to allow nested resolutions)._

### Persistent Bindings (`ownerKey`)

When an `ownerKey` is provided during registration, the binding is marked as "persistent" for that key.

`guardPersistent(this, name, ownerKey)` is invoked on `bind()`, `singleton()`, `instance()`, and `reset()`. It will throw a `PersistentBindingError` (code: `E_PERSISTENT_BINDING`) if the binding already exists, its `persistent` flag is truthy, and `existing.persistent !== providedKey`.

### Bulk Cleanup

`container.cleanup(...ownerKeys)` allows selective clearing processes.

- Without arguments, it removes only **non-persistent** bindings.
- With `ownerKeys` provided, it removes non-persistent bindings **AND** any persistent bindings owned by any of the provided tracking keys. This is useful for clearing specific extension scopes.

## Validation and Errors

- Non-string keys throw `TypeError` (code `E_INVALID_NAME`).
- Non-function factories throw `TypeError` (code `E_INVALID_FACTORY`).
- Resolving undefined bindings throws `Error` (code `E_BINDING_NOT_FOUND`).
