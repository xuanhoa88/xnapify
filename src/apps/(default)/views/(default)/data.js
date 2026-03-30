/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export const featuresData = [
  {
    id: 'lightning-fast',
    name: 'Lightning Fast',
    icon: '⚡',
    description:
      'Server-side rendering with React 16+, automatic code splitting, and optimized Webpack 5 configuration for instant page loads and superior performance',
    details:
      'Our implementation leverages the latest React features (supporting versions 16, 17, and 18+) with server-side rendering (SSR) to deliver blazing-fast initial page loads. Webpack 5 automatically splits your code into optimized chunks that are loaded on demand, significantly reducing bundle sizes. Combined with intelligent prefetching and caching strategies, your users experience near-instant page transitions and superior performance metrics.',
    tags: ['React', 'SSR', 'Performance', 'Webpack'],
  },
  {
    id: 'beautiful-design',
    name: 'Beautiful Design System',
    icon: '🎨',
    description:
      'Professional UI with CSS Modules, design tokens, and responsive layouts. Mobile-first approach with accessibility built-in from day one',
    details:
      'Built with a comprehensive design system featuring CSS Modules for scoped styling, design tokens for consistent theming, and a mobile-first responsive approach. Every component is crafted with accessibility (a11y) in mind, ensuring WCAG compliance and keyboard navigation support. The design system includes a complete set of reusable components, spacing utilities, and color palettes that make building beautiful interfaces effortless.',
    tags: ['CSS Modules', 'Design Tokens', 'Responsive', 'Accessibility'],
  },
  {
    id: 'developer-experience',
    name: 'Developer Experience',
    icon: '🔧',
    description:
      'Hot Module Replacement for instant feedback, Redux DevTools for state debugging, and Jest + React Testing Library for comprehensive testing',
    details:
      'Developer productivity is at the core of this starter kit. Hot Module Replacement (HMR) provides instant feedback during development without losing application state. Redux DevTools integration makes state management transparent and debuggable. The testing setup with Jest and React Testing Library encourages test-driven development with an intuitive API. ESLint and Prettier are pre-configured to maintain code quality and consistency across your team.',
    tags: ['HMR', 'Redux DevTools', 'Jest', 'Testing Library'],
  },
  {
    id: 'global-ready',
    name: 'Global Ready',
    icon: '🌍',
    description:
      'Full internationalization with react-i18next, locale-specific routing, and dynamic language switching. Currently supports English and Vietnamese',
    details:
      'Internationalization (i18n) is built-in from the start using react-i18next, one of the most powerful i18n frameworks for React. The routing system supports locale-specific URLs, and users can switch languages dynamically without page reloads. Translation files are organized by namespace for easy management, and the system supports pluralization, interpolation, and formatting. Currently ships with English and Vietnamese translations, with easy extensibility for additional languages.',
    tags: ['i18n', 'react-i18next', 'Localization', 'Multi-language'],
  },
  {
    id: 'secure-by-default',
    name: 'Secure by Default',
    icon: '🔐',
    description:
      'JWT authentication, protected routes, role-based access control, and security best practices implemented throughout the codebase',
    details:
      'Security is not an afterthought. The authentication system uses JSON Web Tokens (JWT) with secure httpOnly cookies, protecting against XSS attacks. Route guards ensure that protected pages are only accessible to authenticated users with appropriate permissions. Role-based access control (RBAC) is implemented for fine-grained authorization. The codebase follows OWASP security best practices, including CSRF protection, secure headers, input validation, and SQL injection prevention.',
    tags: ['JWT', 'Authentication', 'RBAC', 'Security'],
  },
  {
    id: 'production-ready',
    name: 'Production Ready',
    icon: '🚀',
    description:
      'Docker support, environment configuration, optimized builds, and comprehensive deployment guides. Ship to production with confidence',
    details:
      'This starter kit is battle-tested and production-ready. Docker configuration is included for containerized deployments, with multi-stage builds for optimized image sizes. Environment-specific configuration management makes it easy to deploy to different environments (development, staging, production). The build process generates optimized, minified bundles with source maps for debugging. Comprehensive deployment guides cover popular platforms including Vercel, AWS, Google Cloud, and traditional VPS hosting.',
    tags: ['Docker', 'Deployment', 'CI/CD', 'DevOps'],
  },
];
