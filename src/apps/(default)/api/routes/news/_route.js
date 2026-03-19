/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * GET /api/news
 * Returns mock news data for the home page
 */
export async function get(req, res) {
  // Mock news data - Showcasing React Starter Kit features and updates
  const mockNews = [
    {
      id: 1,
      title: 'Vietnamese Locale Support Added',
      link: '/about?lang=vi-VN',
      contentSnippet:
        'React Starter Kit now supports Vietnamese (vi-VN) locale with full translations for UI elements, navigation, and content pages. Switch languages seamlessly using the language switcher.',
    },
    {
      id: 2,
      title: 'Server-Side Rendering with React 16+',
      link: 'https://react.dev/blog/2022/03/29/react-v18',
      contentSnippet:
        'Built with React 16+ (supports React 16, 17, and 18+) and SSR support for improved performance and SEO. Features automatic code splitting, lazy loading, and optimized bundle sizes for faster page loads.',
    },
    {
      id: 3,
      title: 'Redux State Management',
      link: '/admin',
      contentSnippet:
        'Centralized Redux architecture with organized features: internationalization (intl), runtime variables, and user authentication. Clean public API with simplified imports.',
    },
    {
      id: 4,
      title: 'Modern UI Design System',
      link: '/contact',
      contentSnippet:
        'Professional responsive design with CSS Modules, design tokens, and reusable layout components. Mobile-first approach with proper touch targets and accessibility features.',
    },
    {
      id: 5,
      title: 'Internationalization (i18n) Ready',
      link: '/about',
      contentSnippet:
        'Built-in i18n support with react-i18next. Easily add new languages, locale-specific content, and automatic language detection. Currently supports English and Vietnamese.',
    },
    {
      id: 6,
      title: 'React Starter Kit - Production Ready',
      link: 'https://github.com/xuanhoa88/rapid-rsk',
      contentSnippet:
        'Isomorphic web app boilerplate with Node.js, Express, React 16+ (supports React 16, 17, and 18+), Redux, Webpack 5, CSS Modules, Hot Module Replacement, and comprehensive testing setup.',
    },
  ];

  const http = req.app.get('container').resolve('http');
  return http.sendSuccess(res, { news: mockNews });
}
