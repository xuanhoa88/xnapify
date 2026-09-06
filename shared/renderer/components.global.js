/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Fixes the order of the shared components' stylesheets.
 *
 * Views are chunked one per route, so a shared component's CSS is reached by
 * many chunk groups, each in whatever order that route happens to import
 * things. All of it is then merged into the single `styles` chunk, and when
 * two groups disagree about which of two stylesheets comes first the
 * extractor can only satisfy one of them: it picks a winner and warns
 * (`Conflicting order`). The order it picks is a tie-break over chunk-group
 * iteration, so it can change silently between builds — and with it, which of
 * two same-specificity rules wins.
 *
 * Importing every component stylesheet here, from a module the entry pulls
 * in, gives them one authoritative order that every route group inherits.
 * The context enumerates deterministically, so the order only ever changes
 * when a file is added or renamed.
 *
 * The context enumerates the directory, not the import graph, so it is only
 * free for stylesheets a component already imports — the `styles` cache group
 * hoists those into the one initial stylesheet either way. A `.css` file under
 * `components/` that nothing imports is *not* free: this context is the thing
 * that pulls it into the bundle, and it ships as dead bytes nobody can see.
 * `components.global.test.js` fails the build when one appears.
 *
 * @see tools/rspack/base.config.js — the `styles` cache group
 */
const componentStyles = import.meta.webpackContext('./components', {
  recursive: true,
  regExp: /\.css$/i,
});

componentStyles.keys().sort().forEach(componentStyles);

export default componentStyles;
