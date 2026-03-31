/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export const featuresData = [
  {
    id: 'modular-architecture',
    name: 'Modular Architecture',
    icon: '🧩',
    description:
      'Domain-driven modules auto-discovered via Webpack require.context. Each module owns its API routes, controllers, services, models, migrations, seeds, and views — fully self-contained.',
    details:
      'Every business domain lives under src/apps/ as an independent module. Modules declare lifecycle hooks (translations, providers, migrations, models, seeds, boot, routes) that the framework orchestrates automatically. Webpack require.context scans and registers modules at build time, eliminating manual wiring. Core modules include auth, users, roles, permissions, groups, activities, emails, extensions, files, search, and webhooks — all following the same pattern.',
    tags: ['Auto-Discovery', 'Lifecycle Hooks', 'Domain-Driven', 'Webpack'],
  },
  {
    id: 'extension-system',
    name: 'Extension System',
    icon: '🔌',
    description:
      'Install, activate, and manage extensions at runtime with hooks, slots, and integrity verification. Extend functionality without modifying core code.',
    details:
      'The extension system enables third-party and first-party plugins to integrate seamlessly. Extensions register hooks and slots that core modules listen to, enabling cross-cutting behavior. Built-in extensions include OAuth providers (Google, GitHub, Microsoft, Facebook), profile customization, quick access widgets, search indexing, and webhook plugins. Extensions support integrity verification, dependency resolution, and background installation via worker queues.',
    tags: ['Hooks', 'Slots', 'Plugins', 'Runtime Install'],
  },
  {
    id: 'dependency-injection',
    name: 'Dependency Injection',
    icon: '💉',
    description:
      'Centralized DI container with singleton bindings, factory methods, and ownership keys. Services resolve dependencies at runtime, never via static imports.',
    details:
      'The DI container (container.bind / container.resolve) is the backbone of inter-module communication. Modules register services, controllers, and worker pools during the providers lifecycle phase. Controllers resolve dependencies from req.app.get("container") — never importing across module boundaries. Ownership keys (Symbol) prevent accidental overwrites. The hook system (container.resolve("hook")) enables event-driven communication between decoupled modules.',
    tags: ['Container', 'Providers', 'Singletons', 'Decoupling'],
  },
  {
    id: 'file-based-routing',
    name: 'File-Based Routing',
    icon: '📁',
    description:
      'Convention-based routing with _route.js files. Dynamic segments via [param] folders, route groups with (parentheses), and automatic middleware inheritance.',
    details:
      'Routes are discovered by scanning _route.js files under routes/ directories. Export named HTTP verb functions (get, post, put, delete) or arrays with middleware chains. Dynamic route parameters use bracket notation ([id]), and route groups use parenthesized folder names ((admin), (default)). Frontend views follow the same convention with lifecycle hooks: getInitialProps for SSR data, init/setup/teardown/mount/unmount for page lifecycle management, and middleware exports for permission guards.',
    tags: ['Convention', '_route.js', 'SSR', 'Lifecycle'],
  },
  {
    id: 'rbac-security',
    name: 'RBAC Security',
    icon: '🔐',
    description:
      'Role-based access control with JWT authentication, permission guards, user groups, API key strategies, and OAuth provider integration.',
    details:
      'The auth module implements a full RBAC system: Users are assigned Roles, Roles grant Permissions (resource:action pairs), and Users belong to Groups. JWT tokens are stored in httpOnly cookies with refresh token rotation. Route-level permission guards (requirePermission) enforce access control. The system supports multiple authentication strategies including local credentials, API keys, and OAuth providers (Google, GitHub, Microsoft, Facebook) via Passport.js. Admin impersonation is built-in for debugging.',
    tags: ['JWT', 'Permissions', 'OAuth', 'Guards'],
  },
  {
    id: 'full-stack-tooling',
    name: 'Full-Stack Tooling',
    icon: '🛠️',
    description:
      'Webpack 5 builds, Sequelize ORM with migrations, Redux Toolkit with dynamic injection, Piscina worker pools, queue-based workers, and Docker deployment.',
    details:
      'The build system uses Webpack 5 for both server and client bundles with automatic code splitting, CSS Modules, and hot module replacement. The backend runs on Express with Sequelize ORM supporting SQLite, PostgreSQL, and MySQL via runtime driver installation. Redux Toolkit powers frontend state with dynamic slice injection via store.injectReducer(). CPU-intensive work offloads to Piscina worker pools, while queue-based workers handle background jobs. Production deployment uses multi-stage Docker builds with preboot hooks for driver installation.',
    tags: ['Webpack 5', 'Sequelize', 'Redux', 'Docker'],
  },
];
