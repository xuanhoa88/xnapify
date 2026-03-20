# Application Root Specification (`src/`)

The core architectural principles for the `src` directory involve a robust separation of concerns between client and server execution environments, modularity through the `apps/` and `plugins/` ecosystems, and strict scoped dependency injection.

## 1. Client Architecture (`client.js`)

The client entrypoint is responsible for establishing a robust single-page application experience with the following features:
- **Dependency Injection**: Initializes a `@shared/container` instance scoped specifically for the client lifecycle.
- **State Management**: Hydrates the Redux store from the SSR payload (`window.__PRELOADED_STATE__`) and synchronizes initial context bindings.
- **Rendering**: Implements progressive enhancement, first attempting concurrent `ReactDOM.hydrateRoot`, with fallback capabilities to legacy `.render()` modes on error.
- **Routing**: Manages `history` navigation, intercepts internal links to preserve application state, processes Chunk Load Errors, and orchestrates page metadata generation during transitions.
- **Real-Time Context**: Configures a `@shared/ws/client` with automatic reconnection mechanisms and token refresh loops tied to browser visibility (`visibilitychange`).
- **Scroll Preservation**: A custom tracking implementation logs pixel scroll positions (`x/y` coordinates) matched against history location keys to intelligently restore positions on back/forward browser navigation.

## 2. Server Architecture (`server.js`)

The `server.js` functions as an Express.js entrypoint that manages HTTP requests prior to delegating them to the appropriate `apps/` endpoints or resolving React SSR requests.
- **SSR (Server-Side Rendering)**: Instantiates a request-isolated container and handles the full application bootstrap lifecycle (Redux, Router, i18n bindings) to emit static HTML payloads paired with synchronous preloaded state.
- **Caching**: Employs an LRU Cache (`RSK_SSR_CACHE`) tied to request path, requested locale, and authentication hashes to bypass expensive React operations whenever possible.
- **Security & Stability**: Resolves dynamic CSP nonces per request, enforces rate limiting (`RSK_RATE_LIMIT`), blocks oversized cookies, and intercepts potentially malformed request vectors early.
- **Development Tooling**: Integrates `webpack-hot-middleware` for HMR, leverages `youch` for rich server-bound error logging, and pipes internal timings (`X-Render-Time`) locally.
- **Dependency Injection**: All service providers are registered on a `@shared/container` instance via `container.bind()`/`container.instance()`. Modules and engines resolve dependencies through `container.resolve(key)` — they never access the Express `app` directly.

## 3. Module Orchestration (`apps/` & `plugins/`)

The source level intentionally avoids static route registration. Instead, it aggregates features from modular sub-directories during the bootstrap phase:
- **Bootstrapping**: Components within `bootstrap/views.js` resolve route trees from the autonomous applications housed in `apps/`.
- **Extensibility**: Elements within `plugins/` are permitted to inject middleware or frontend UI elements asynchronously without statically linking against core code paths, utilizing the `@shared/extension/` pub/sub and registry interfaces.
