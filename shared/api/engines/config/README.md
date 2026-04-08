# Config Engine

The `config` engine securely manages application configuration from environment variables and acts as an immutable registry for the DI container.

## Features

- **Picks up all `process.env`** variables prefixed with `XNAPIFY_` on startup and exposes them via a clean, prefix-less key format.
- **Namespaced wrappers** allow extensions or modules to define and read scoped configurations without colliding.
- **Environment Protection**: Wraps `process.env` in a Proxy to prevent runtime modification or deletion of `XNAPIFY_` keys, preventing rogue behaviour and unexpected bugs.
- **Immutable core configuration**: The config instance data object is fully frozen.

## Usage

Access the engine via the DI container.

```javascript
import container from '@shared/container';

const config = container.resolve('config');

// Retrieves XNAPIFY_PORT (stripped as PORT)
const port = config.get('PORT');

// For Extensions/Modules: use a namespace
const extConfig = config.withNamespace('MY_EXT');

// Set a scoped extension configuration (stored as MY_EXT_API_KEY)
extConfig.set('API_KEY', 'xnap-12345');

// `use` is an alias for `get`
const key = extConfig.use('API_KEY'); 

// Fallback lookup: if MY_EXT_DEBUG is not set on the namespace, 
// it falls back to coreConfig['MY_EXT_DEBUG'] (loaded from XNAPIFY_MY_EXT_DEBUG)
const isDebugMode = extConfig.use('DEBUG');
```

## Security & Plug & Play
Because xnapify dynamically loads user-provided or third-party extensions, the core configuration protects its integrity. Any extension attempting to run `process.env.XNAPIFY_PORT = 80;` will immediately throw an error.
