/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const path = require('path');

let cachedPlugins = null;

module.exports = ({ cwd }) => {
  if (!cachedPlugins) {
    cachedPlugins = [
      // Transfer @import rule by inlining content, e.g. @import 'normalize.css'
      // Must run before other plugins so imported content gets processed.
      // https://github.com/postcss/postcss-import
      require('postcss-import')(),

      // Tailwind CSS
      // https://tailwindcss.com/docs/installation
      require('tailwindcss')({
        content: [
          path.join(cwd, 'src/**/*.{js,jsx,ts,tsx}').replace(/\\/g, '/'),
          path.join(cwd, 'shared/**/*.{js,jsx,ts,tsx}').replace(/\\/g, '/'),
          '!' + path.join(cwd, 'src/**/node_modules/**').replace(/\\/g, '/'),
          '!' + path.join(cwd, 'shared/**/node_modules/**').replace(/\\/g, '/'),
        ],
        theme: {
          extend: {},
        },
        corePlugins: {
          // Disable Tailwind's preflight to avoid overriding Radix UI Themes
          preflight: false,
        },
        plugins: [],
      }),

      // postcss-preset-env bundles modern PostCSS plugins and automatically
      // determines which CSS polyfills are needed based on the browserslist
      // configuration. Replaces 10+ individual plugins:
      //   - postcss-custom-properties (CSS Variables fallback)
      //   - postcss-custom-media (CSS Custom Media Queries)
      //   - postcss-custom-selectors (CSS Custom Selectors)
      //   - postcss-nesting (W3C CSS Nesting)
      //   - postcss-calc (CSS calc() reduction)
      //   - postcss-media-minmax (CSS Media Queries ranges)
      //   - postcss-selector-not (CSS :not() Level 4)
      //   - postcss-is-pseudo-class (CSS :is() / formerly :matches())
      //   - @csstools/postcss-color-function (CSS color() function)
      //   - autoprefixer (vendor prefixes)
      // https://github.com/csstools/postcss-plugins/tree/main/plugin-packs/postcss-preset-env
      require('postcss-preset-env')({
        // Stage 2: Likely to become standard (editor's drafts + working drafts)
        stage: 2,

        features: {
          // Enable CSS nesting via & parent selector
          'nesting-rules': true,
        },

        // Autoprefixer options
        autoprefixer: {
          // Browserslist config will be read from .browserslistrc automatically
          flexbox: 'no-2009',
        },
      }),

      // Unwraps nested rules like how Sass does it.
      // Kept alongside postcss-nesting (from preset-env) for backward
      // compatibility with Sass-style patterns (& .child, &:hover, &::pseudo).
      // https://github.com/postcss/postcss-nested
      require('postcss-nested')(),

      // Postcss flexbox bug fixer — still relevant for Safari 14 edge cases
      // https://github.com/luisrudge/postcss-flexbugs-fixes
      require('postcss-flexbugs-fixes')(),
    ];
  }

  return { plugins: cachedPlugins };
};
