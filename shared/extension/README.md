# Shared Extension

The core extension architecture for React Starter Kit. It provides a universal Extension Registry for cross-extension communication, dependency injection, UI slots, and backend extension points (hooks), along with server-side API loading and client-side advanced Webpack Module Federation (MF).

## Quick Start
Extensions encapsulate domain-specific logic and UI. 

**Backend Extensibility:**
```javascript
import { registry } from '@shared/extension/utils';

// Expose a hook
await registry.executeHook('users.created', { userId: 123 });

// Register to a hook
registry.registerHook('users.created', async (data) => {
    console.log('User created:', data.userId);
});
```

**Frontend Extensibility (UI Slots):**
```jsx
import { ExtensionSlot } from '@shared/extension/client';

// Define a slot in the main app
export default function UserProfile() {
    return (
        <div>
           <h1>User Profile</h1>
           {/* Extensions inject React components here */}
           <ExtensionSlot name="user.profile.tabs" /> 
        </div>
    );
}
```

```jsx
// Register a component into the slot from a extension
import { registry } from '@shared/extension/utils';

registry.registerSlot('user.profile.tabs', MyCustomTabComponent, { order: 10 });
```

## Architecture

The extension system contains universal utilities, client-specific managers, and server-specific managers. 

- **Registry (`utils/Registry.js`)**: Universal. Manages `slots`, `hooks`, and `definitions`. Tracks registrations per extension ID allowing for clean uninstalls and reloads without memory leaks.
- **Hook (`utils/Hook.js`)**: Universal. Executes registered callbacks sequentially (`execute`) or concurrently (`executeParallel`).
- **ClientExtensionManager (`client/manager.js`)**: Discovers extension manifests from the server, injects `extension.css` and `remote.js` tags into the DOM, and orchestrates Webpack Module Federation (`container.init` and `container.get('./extension')`) to load React code at runtime.
- **ServerExtensionManager (`server/manager.js`)**: Exposes physical filesystem resolving (`resolveExtensionDir`), reads package.json manifests natively, and loads backend extension code (`api.js`) to trigger lifecycle events (`install`, `uninstall`, `init`, `destroy`).
- **ExtensionSlot (`client/ExtensionSlot.js`)**: A React component that listens to `Registry` changes and dynamically renders arrays of components injected by extensions.

## Creating a Extension

Extensions are dynamically loaded. Their capabilities are defined by entry points defined in their `package.json` (`main` for API/Server, `browser` for View/Client).

A standard extension exports an object with `init` and `destroy` methods:

```javascript
// Example Extension API (api.js or browser.js)
export default {
    async init(registry, context) {
       // Register hooks, slots, or middlewares
    },
    async destroy(registry, context) {
       // Automatic cleanup happens via the Registry,
       // but custom teardown goes here (e.g. closing DB connections)
    }
}
```

## Advanced Loading (SSR vs Client)

During Server-Side Rendering (SSR), the `ServerExtensionManager` passes the physical paths to the bundles to the React renderer ensuring extensions render synchronously. 

On the client, the `ClientExtensionManager` intercepts the payload. It waits for the main application's `__webpack_share_scopes__` to initialize, injects `<script>` tags for each extension's `remote.js`, binds the Module Federation container, and executes the extension.

## See Also
- [SPEC.md](./SPEC.md) — Technical specification
