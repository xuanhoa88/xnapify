# Shared Container

Lightweight, isomorphic Dependency Injection (DI) container.
Works identically on both client (browser) and server (Node.js) using standard ES features without platform-specific APIs.

## Quick Start

```javascript
import container from '@shared/container';

// Register a factory (new object each time)
container.bind('logger', () => new Logger());

// Register a singleton (created once)
container.singleton('db', () => createConnection());

// Register a pre-built value
container.instance('config', { debug: true });

// Resolve
const logger = container.resolve('logger');
const db     = container.resolve('db'); // same instance every time
const cfg    = container.make('config'); // alias for resolve
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

## See Also

- [SPEC.md](./SPEC.md) — Technical specification
