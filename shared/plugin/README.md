# Shared Plugin

The core plugin architecture for React Starter Kit. It provides a universal Plugin Registry for cross-plugin communication, dependency injection, UI slots, and backend extension points (hooks), along with server-side API loading and client-side advanced Webpack Module Federation (MF).

## Quick Start
Plugins encapsulate domain-specific logic and UI. 

**Backend Extensibility:**
```javascript
import { registry } from '@shared/plugin/utils';

// Expose a hook
await registry.executeHook('users.created', { userId: 123 });

// Register to a hook
registry.registerHook('users.created', async (data) => {
    console.log('User created:', data.userId);
});
```

**Frontend Extensibility (UI Slots):**
```jsx
import { PluginSlot } from '@shared/plugin/client';

// Define a slot in the main app
export default function UserProfile() {
    return (
        <div>
           <h1>User Profile</h1>
           {/* Plugins inject React components here */}
           <PluginSlot name="user.profile.tabs" /> 
        </div>
    );
}
```

```jsx
// Register a component into the slot from a plugin
import { registry } from '@shared/plugin/utils';

registry.registerSlot('user.profile.tabs', MyCustomTabComponent, { order: 10 });
```

## Architecture

The plugin system contains universal utilities, client-specific managers, and server-specific managers. 

- **Registry (`utils/Registry.js`)**: Universal. Manages `slots`, `hooks`, and `definitions`. Tracks registrations per plugin ID allowing for clean uninstalls and reloads without memory leaks.
- **Hook (`utils/Hook.js`)**: Universal. Executes registered callbacks sequentially (`execute`) or concurrently (`executeParallel`).
- **ClientPluginManager (`client/manager.js`)**: Discovers plugin manifests from the server, injects `plugin.css` and `remote.js` tags into the DOM, and orchestrates Webpack Module Federation (`container.init` and `container.get('./plugin')`) to load React code at runtime.
- **ServerPluginManager (`server/manager.js`)**: Exposes physical filesystem resolving (`resolvePluginDir`), reads package.json manifests natively, and loads backend plugin code (`api.js`) to trigger lifecycle events (`install`, `uninstall`, `init`, `destroy`).
- **PluginSlot (`client/PluginSlot.js`)**: A React component that listens to `Registry` changes and dynamically renders arrays of components injected by plugins.

## Creating a Plugin

Plugins are dynamically loaded. Their capabilities are defined by entry points defined in their `package.json` (`main` for API/Server, `browser` for View/Client).

A standard plugin exports an object with `init` and `destroy` methods:

```javascript
// Example Plugin API (api.js or browser.js)
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

During Server-Side Rendering (SSR), the `ServerPluginManager` passes the physical paths to the bundles to the React renderer ensuring plugins render synchronously. 

On the client, the `ClientPluginManager` intercepts the payload. It waits for the main application's `__webpack_share_scopes__` to initialize, injects `<script>` tags for each plugin's `remote.js`, binds the Module Federation container, and executes the plugin.

## See Also
- [SPEC.md](./SPEC.md) — Technical specification
