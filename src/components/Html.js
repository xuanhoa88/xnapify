/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import serialize from 'serialize-javascript';

/**
 * Renders Open Graph meta tags for social media sharing
 */
function OpenGraphMeta({ title, description, type, url, image }) {
  return (
    <>
      <meta property='og:title' content={title} />
      <meta property='og:description' content={description} />
      <meta property='og:type' content={type} />
      {url && <meta property='og:url' content={url} />}
      {image && <meta property='og:image' content={image} />}
    </>
  );
}

OpenGraphMeta.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  url: PropTypes.string,
  image: PropTypes.string,
};

/**
 * Renders loadable component state scripts
 * Required for @loadable/component SSR hydration
 */
function LoadableStateScripts({ loadableState }) {
  if (!loadableState) return null;

  const { requiredChunks, namedChunks } = loadableState;

  return (
    <>
      {requiredChunks && (
        <script
          id='__LOADABLE_REQUIRED_CHUNKS__'
          type='application/json'
          dangerouslySetInnerHTML={{ __html: requiredChunks }}
        />
      )}
      {namedChunks && (
        <script
          id='__LOADABLE_REQUIRED_CHUNKS___ext'
          type='application/json'
          dangerouslySetInnerHTML={{ __html: namedChunks }}
        />
      )}
    </>
  );
}

LoadableStateScripts.propTypes = {
  loadableState: PropTypes.shape({
    requiredChunks: PropTypes.string,
    namedChunks: PropTypes.string,
  }),
};

/**
 * HTML document template component
 * Renders the complete HTML structure for server-side rendering
 *
 * @param {Object} props - Component props
 * @param {string} props.title - Page title
 * @param {string} props.description - Page description
 * @param {string} [props.image] - Open Graph image URL
 * @param {string} [props.url] - Canonical URL
 * @param {string} [props.locale] - Default locale
 * @param {string} [props.type='website'] - Open Graph type
 * @param {Array} [props.styles=[]] - Inline CSS styles from @loadable/component
 * @param {Array} [props.styleLinks=[]] - CSS file URLs
 * @param {Array} [props.scripts=[]] - JavaScript file URLs
 * @param {Object} [props.loadableState] - Loadable component state for SSR
 * @param {Object} props.appState - Application state and configuration (redux)
 * @param {string} props.children - Rendered React app HTML
 */
function Html({
  title,
  description,
  image = null,
  url = null,
  type = 'website',
  locale = 'en-US',
  styles = [],
  styleLinks = [],
  scripts = [],
  loadableState = null,
  appState,
  children,
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
        <link rel='shortcut icon' href={`/rsk.ico?v=${Date.now()}`} />

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

        {/* Stylesheets from @loadable/component */}
        {styleLinks.map(href => (
          <link key={href} rel='stylesheet' href={href} />
        ))}

        {/* Preload JavaScript bundles */}
        {scripts.map(src => (
          <link key={src} rel='preload' href={src} as='script' />
        ))}

        {/* PWA manifest and icons */}
        <link rel='manifest' href={`/site.webmanifest?v=${Date.now()}`} />
        <link
          rel='apple-touch-icon'
          href={`/rsk_192x192.png?v=${Date.now()}`}
        />

        {/* Critical inline CSS from @loadable/component */}
        {styles.map(({ cssText }, index) => (
          <style
            key={index}
            data-ssr=''
            dangerouslySetInnerHTML={{ __html: cssText }}
          />
        ))}
      </head>
      <body>
        {/* React app root */}
        <div id='app' dangerouslySetInnerHTML={{ __html: children }} />

        {/* Loadable component state (must come before app state) */}
        <LoadableStateScripts loadableState={loadableState} />

        {/* Application state */}
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__PRELOADED_STATE__=${serialize(appState)}`,
          }}
        />

        {/* JavaScript bundles */}
        {scripts.map(src => (
          <script key={src} src={src} />
        ))}
      </body>
    </html>
  );
}

Html.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  image: PropTypes.string,
  url: PropTypes.string,
  type: PropTypes.string,
  styles: PropTypes.arrayOf(
    PropTypes.shape({
      cssText: PropTypes.string.isRequired,
    }),
  ),
  locale: PropTypes.string,
  styleLinks: PropTypes.arrayOf(PropTypes.string),
  scripts: PropTypes.arrayOf(PropTypes.string),
  loadableState: PropTypes.shape({
    requiredChunks: PropTypes.string,
    namedChunks: PropTypes.string,
  }),
  appState: PropTypes.shape({
    redux: PropTypes.object,
  }),
  children: PropTypes.string.isRequired,
};

export default Html;
