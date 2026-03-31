/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * HTML Document Template Module
 *
 * Provides the complete HTML document structure for server-side rendering (SSR).
 * This component is responsible for:
 * - Rendering the HTML shell with proper meta tags
 * - Injecting critical CSS and JavaScript
 * - Setting up Open Graph tags for social media
 * - Hydrating client-side state (Redux, Loadable components)
 * - Optimizing for SEO and performance
 *
 * @example
 * const html = renderToString(
 *   <Html
 *     title="My App"
 *     description="A React application"
 *     locale="en-US"
 *     scriptLinks={['/client.js']}
 *     styleLinks={['/styles.css']}
 *     appState={{ redux: store.getState() }}
 *   >
 *     {appHtml}
 *   </Html>
 * );
 */

import PropTypes from 'prop-types';
import serialize from 'serialize-javascript';

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Renders Open Graph meta tags for social media sharing
 *
 * @param {Object} props
 * @param {string} props.title - Page title for social sharing
 * @param {string} props.description - Page description for social sharing
 * @param {string} props.type - Open Graph type (e.g., 'website', 'article')
 * @param {string} [props.url] - Canonical URL for the page
 * @param {string} [props.image] - Image URL for social sharing preview
 * @returns {React.ReactElement} Open Graph meta tags
 */
function OpenGraphMeta({ title, description, type, url, image }) {
  return (
    <>
      {title && <meta property='og:title' content={title} />}
      {description && <meta property='og:description' content={description} />}
      {type && <meta property='og:type' content={type} />}
      {url && <meta property='og:url' content={url} />}
      {image && <meta property='og:image' content={image} />}
    </>
  );
}

/**
 * PropTypes for the OpenGraphMeta component
 */
OpenGraphMeta.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  type: PropTypes.string,
  url: PropTypes.string,
  image: PropTypes.string,
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * HTML document template component for server-side rendering
 *
 * Renders the complete HTML structure including:
 * - Meta tags for SEO and social sharing
 * - CSS and JavaScript resources
 * - Serialized application state for hydration
 * - Optimizing for SEO and performance
 *
 * @param {Object} props - Component props
 * @param {string} props.title - Page title
 * @param {string} props.description - Page description
 * @param {string} [props.image] - Open Graph image URL
 * @param {string} [props.url] - Canonical URL
 * @param {string} [props.locale='en-US'] - Document locale
 * @param {string} [props.type='website'] - Open Graph type
 * @param {Array} [props.styleLinks=[]] - CSS file URLs
 * @param {Array} [props.scriptLinks=[]] - JavaScript file URLs
 * @param {Object} props.appState - Application state (contains Redux state)
 * @param {string} props.children - Rendered React app HTML
 * @returns {React.ReactElement} Complete HTML document
 */
export default function Html({
  title,
  description,
  image = null,
  url = null,
  type = 'website',
  locale = 'en-US',
  styleLinks = [],
  scriptLinks = [],
  appState,
  children,
  nonce,
}) {
  return (
    <html className='no-js' lang={locale || 'en-US'}>
      <head>
        {/* Basic meta tags */}
        <meta charSet='utf-8' />
        <meta httpEquiv='x-ua-compatible' content='ie=edge' />
        <meta name='viewport' content='width=device-width, initial-scale=1' />

        {/* Page metadata */}
        <title>{title}</title>
        <meta name='description' content={description} />

        {/* Favicons — multi-size for cross-browser support */}
        <link rel='icon' type='image/x-icon' href='/favicon.ico' />
        <link
          rel='icon'
          type='image/png'
          sizes='16x16'
          href='/xnapify_16x16.png'
        />
        <link
          rel='icon'
          type='image/png'
          sizes='32x32'
          href='/xnapify_32x32.png'
        />
        <link
          rel='icon'
          type='image/png'
          sizes='48x48'
          href='/xnapify_48x48.png'
        />

        {/* Theme color for mobile browsers */}
        <meta name='theme-color' content='#F57C00' />

        {/* Windows tile configuration */}
        <meta name='msapplication-config' content='/browserconfig.xml' />

        {/* Open Graph meta tags for social media */}
        <OpenGraphMeta
          title={title}
          description={description}
          type={type}
          url={url}
          image={image}
        />

        {/* Canonical URL for SEO */}
        {url && <link rel='canonical' href={url} />}

        {/* CSS stylesheets */}
        {styleLinks.map(entry => {
          const href = typeof entry === 'string' ? entry : entry.href;
          const id = typeof entry === 'object' ? entry.id : undefined;
          return (
            <link
              key={href}
              rel='stylesheet'
              type='text/css'
              href={href}
              {...(id ? { 'data-extension-id': id } : {})}
            />
          );
        })}

        {/* Application state for client hydration */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.__PRELOADED_STATE__=${serialize(appState)}`,
          }}
        />

        {/* Preload JavaScript bundles for faster loading */}
        {scriptLinks.map(entry => {
          const src = typeof entry === 'string' ? entry : entry.src;
          const id = typeof entry === 'object' ? entry.id : undefined;
          return (
            <link
              key={`preload-${src}`}
              rel='preload'
              href={src}
              as='script'
              {...(id ? { 'data-extension-id': id } : {})}
            />
          );
        })}

        {/* PWA manifest and icons */}
        <link rel='manifest' href='/site.webmanifest' />
        <link rel='apple-touch-icon' href='/xnapify_192x192.png' />
      </head>
      <body>
        {/* React app root */}
        <div id='app' dangerouslySetInnerHTML={{ __html: children }} />

        {/* JavaScript bundles */}
        {scriptLinks.map(entry => {
          const src = typeof entry === 'string' ? entry : entry.src;
          const id = typeof entry === 'object' ? entry.id : undefined;
          return (
            <script
              key={src}
              type='text/javascript'
              src={src}
              {...(id ? { 'data-extension-id': id } : {})}
            />
          );
        })}
      </body>
    </html>
  );
}

/**
 * PropTypes for the Html component
 */
Html.propTypes = {
  /** Page title (appears in browser tab and search results) */
  title: PropTypes.string.isRequired,
  /** Page description (for SEO and social sharing) */
  description: PropTypes.string.isRequired,
  /** Open Graph image URL for social media previews */
  image: PropTypes.string,
  /** Canonical URL for the page (for SEO) */
  url: PropTypes.string,
  /** Open Graph type (e.g., 'website', 'article', 'product') */
  type: PropTypes.string,
  /** Document locale (e.g., 'en-US', 'fr-FR') */
  locale: PropTypes.string,
  /** CSS entries: URLs (string) or { href, id } objects */
  styleLinks: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({ href: PropTypes.string, id: PropTypes.string }),
    ]),
  ),
  /** JS entries: URLs (string) or { src, id } objects */
  scriptLinks: PropTypes.arrayOf(
    PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.shape({ src: PropTypes.string, id: PropTypes.string }),
    ]),
  ),
  /** Application state for client-side hydration */
  appState: PropTypes.shape({
    redux: PropTypes.object.isRequired,
  }).isRequired,
  /** CSP nonce for inline scripts */
  nonce: PropTypes.string,
  /** Rendered React app HTML string */
  children: PropTypes.string.isRequired,
};
