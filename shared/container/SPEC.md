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
const BINDINGS = Symbol('__rsk.containerBindings__');

class Container {
  constructor() {
    this[BINDINGS] = new Map();
  }
}
```

### Binding Record Shape

Each entry in the map has the following shape:

| Property     | Type       | Description                                 |
|--------------|------------|---------------------------------------------|
| `type`       | `string`   | Resolving strategy (`factory`, `singleton`, `instance`) |
| `factory`    | `Function` | (Optional) Function to generate the value |
| `value`      | `*`        | (Optional) Cached outcome or direct instance|
| `resolved`   | `boolean`  | (Singletons only) True if resolved          |
| `persistent` | `*`        | Developer provided `ownerKey` or `false`     |

### Resolution Strategies

- **`INSTANCE` (`container.instance()`)**: Returns the `value` directly.
- **`SINGLETON` (`container.singleton()`)**: If `resolved: false`, it executes `factory(this)` passing the container instance as an argument, caches the result in `value`, marks `resolved: true`, and returns `value`. Otherwise, returns cached `value`.
- **`FACTORY` (`container.bind()`, `container.factory()`)**: Executes `factory(this)` and returns the new value every time.

*(The container reference `this` is passed to every factory invocation to allow nested resolutions).*

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
