/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import tailwindcssPostcss from '@tailwindcss/postcss';
import postcssFlexbugsFixes from 'postcss-flexbugs-fixes';
import postcssNested from 'postcss-nested';
import postcssPresetEnv from 'postcss-preset-env';

import radixBreakpointTrim from '../postcss/RadixBreakpointTrim.js';

export default ({ cwd } = {}) => ({
  plugins: [
    // Tailwind CSS v4 — CSS-first configuration
    // `base` sets the root directory for content detection context.
    // However, auto-detection scans from the CSS file's directory by default.
    // For broader scanning (e.g., entire src/), explicit content paths are required
    // in the CSS import: @import 'tailwindcss' content(from: 'path').
    // https://tailwindcss.com/docs/installation
    tailwindcssPostcss({ base: cwd }),

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
    postcssPresetEnv({
      // Stage 2: Likely to become standard (editor's drafts + working drafts)
      stage: 2,

      features: {
        // Enable CSS nesting via & parent selector
        'nesting-rules': true,

        // Disable @layer polyfill. When enabled, postcss-preset-env replaces
        // @layer with :not(#\#) selectors to emulate layer specificity on old
        // browsers. This inflates selector weight and breaks the cascade order
        // defined in app.global.css (theme < base < radix-ui < components < utilities).
        // With this disabled, @layer passes through natively on modern browsers
        // (95%+ support) and degrades gracefully to source order on old ones.
        'cascade-layers': false,
      },

      // Autoprefixer options
      autoprefixer: {
        // Browserslist config will be read from .browserslistrc automatically
        flexbox: 'no-2009',
      },
    }),

    // Unwraps nested rules like how Sass does it.
    // NOTE: Redundant with postcss-preset-env's 'nesting-rules': true.
    // Kept for backward compatibility with Sass-style patterns (& .child, &:hover, &::pseudo).
    // Consider removing if preset-env's nesting suffices.
    // https://github.com/postcss/postcss-nested
    postcssNested(),

    // Postcss flexbox bug fixer — still relevant for Safari 14 edge cases
    // https://github.com/luisrudge/postcss-flexbugs-fixes
    postcssFlexbugsFixes(),

    // Drop Radix Themes responsive variants for breakpoints no component
    // asks for. Runs last so it sees the fully expanded stylesheet, and
    // only removes media blocks made up entirely of Radix variant rules.
    // The breakpoints to keep are derived by scanning `cwd` for responsive
    // props, so a newly written `{ initial: '1', xl: '4' }` keeps its CSS.
    radixBreakpointTrim({ cwd }),
  ],
});
