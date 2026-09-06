/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Guards `components.global.js` against orphan stylesheets.
 *
 * That file enumerates `components/` with a directory context, not the import
 * graph, so a `.css` file no component imports is still bundled — it lands in
 * the initial `styles` chunk as bytes nothing can ever apply. Six of them had
 * accumulated (~16 KB) beside their real siblings: `FormDate.css` next to
 * `Date.css`, `Table.css` next to `TablePagination.css`, and so on — the same
 * pathology as the `Toast.css`/`Index.css` pair.
 *
 * This test walks the import graph the other way round: every `.css` under
 * `components/` must be reached by at least one `import` from a `.js` file, or
 * by `composes … from` / `@import` in another stylesheet.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const COMPONENTS = path.join(ROOT, 'shared/renderer/components');

/** Every file under `dir` whose name matches `re`, recursively. */
function filesUnder(dir, re) {
  const out = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (re.test(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

/**
 * Absolute paths of every stylesheet reached by a relative import.
 *
 * Both routes into a stylesheet count: `import s from './X.css'` (and the
 * side-effect form) from JavaScript, and `composes … from './X.css'` or
 * `@import './X.css'` from another stylesheet.
 */
function importedStylesheets(sourceRoots) {
  const specifier = /(?:from|@import)\s*(['"])(\.[^'"]+\.css)\1/g;
  const bareImport = /import\s*(['"])(\.[^'"]+\.css)\1/g;
  const imported = new Set();

  for (const root of sourceRoots) {
    for (const file of filesUnder(root, /\.(js|css)$/)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const re of [specifier, bareImport]) {
        re.lastIndex = 0;
        for (const match of text.matchAll(re)) {
          imported.add(path.resolve(path.dirname(file), match[2]));
        }
      }
    }
  }

  return imported;
}

describe('components.global.js stylesheet context', () => {
  it('bundles no stylesheet that nothing imports', () => {
    const imported = importedStylesheets([
      path.join(ROOT, 'shared'),
      path.join(ROOT, 'src'),
    ]);

    const orphans = filesUnder(COMPONENTS, /\.css$/i)
      .filter(file => !imported.has(file))
      .map(file => path.relative(ROOT, file))
      .sort();

    expect(orphans).toEqual([]);
  });
});
