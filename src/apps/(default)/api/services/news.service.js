/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// ========================================================================
// NEWS DATA
// ========================================================================

const NEWS_ITEMS = [
  {
    id: 1,
    title: 'Extension System with Hooks & Slots',
    link: '/features/extension-system',
    contentSnippet:
      'Install, activate, and manage extensions at runtime. Built-in plugins include OAuth providers (Google, GitHub, Microsoft, Facebook), profile customization, quick access widgets, and search indexing — all without modifying core code.',
  },
  {
    id: 2,
    title: 'Modular Auto-Discovery Architecture',
    link: '/features/modular-architecture',
    contentSnippet:
      'Domain modules under src/apps/ are automatically discovered via Webpack require.context. Each module declares lifecycle hooks (providers, migrations, models, seeds, boot, routes) — no manual registration required.',
  },
  {
    id: 3,
    title: 'File-Based Routing with SSR',
    link: '/features/file-based-routing',
    contentSnippet:
      'Convention-based routing using _route.js files. Export HTTP verb handlers, dynamic [param] segments, route groups with (parentheses), and getInitialProps for server-side data fetching.',
  },
  {
    id: 4,
    title: 'RBAC with JWT & OAuth',
    link: '/features/rbac-security',
    contentSnippet:
      'Full role-based access control: Users, Roles, Permissions, and Groups. JWT with httpOnly cookies, refresh token rotation, API key strategy, and OAuth integration via Passport.js.',
  },
  {
    id: 5,
    title: 'DI Container & Hook System',
    link: '/features/dependency-injection',
    contentSnippet:
      'Centralized dependency injection with ownership keys prevents cross-module coupling. The hook system enables event-driven communication between decoupled modules without static imports.',
  },
  {
    id: 6,
    title: 'Production-Ready Tooling',
    link: '/features/full-stack-tooling',
    contentSnippet:
      'Webpack 5 bundles with code splitting, Sequelize ORM with multi-database support, Redux Toolkit with dynamic injection, background worker functions, and multi-stage Docker deployment.',
  },
];

// ========================================================================
// NEWS SERVICE
// ========================================================================

/**
 * Get all news items
 *
 * @returns {Array<Object>} List of news items
 */
export function getNews() {
  return NEWS_ITEMS;
}
