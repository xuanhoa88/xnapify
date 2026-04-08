# Config Engine Specification

## Overview
The `config` engine provides a centralized, read-only configuration service built from `process.env` keys starting with `XNAPIFY_`. It explicitly blocks mutation of the original environment variables to enforce stability while allowing dynamic namespaced properties for extensions.

## Core API
`container.resolve('config')` returns the core config instance.

```typescript
interface ConfigEngine {
  /** Retrieves a value from the core configuration */
  get(key: string): string | undefined;

  /** Returns a shallow copy of all core configuration keys and values */
  all(): Record<string, string>;

  /** Creates or retrieves a scoped configuration wrapper for a specific namespace */
  withNamespace(namespace: string): NamespacedConfig;
}
```

## Namespaced API
The namespaced wrapper handles values prefixed by its namespace, automatically falling back to the core config.

```typescript
interface NamespacedConfig {
  /** Sets a value specific to this namespace */
  set(key: string, value: string): void;

  /** Retrieves a value from the namespace, falling back to core config */
  get(key: string): string | undefined;

  /** Alias for get() */
  use(key: string): string | undefined;

  /** Returns a shallow copy merging core and namespace values */
  all(): Record<string, string>;
}
```

## Security Guarantees
1. `coreConfig` is frozen (`Object.freeze`).
2. The `XNAPIFY_` prefix is stripped from the loaded core keys for convenience.
3. Mutations (set/delete) on `process.env` targeting `XNAPIFY_` are intercepted and rejected via a `Proxy`.
