/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Guards how CSS-module class names may be read.
 *
 * css-loader 7 picks its export convention from `esModule`:
 *
 *   const exportLocalsConvention =
 *     rawModulesOptions.exportLocalsConvention ??
 *     (namedExport ? 'as-is' : 'camel-case-only');
 *
 * tools/rspack/base.config.js sets `esModule: false` and does not override the
 * convention, so `namedExport` is false and the effective convention is
 * **camel-case-only**: a `.variant-success` rule is exported as
 * `variantSuccess` and under no other key.
 *
 * That makes `s['variant-success']` return `undefined`, React drop the
 * `className`, and the element render unstyled — with no error anywhere. It
 * cost the Toast component its success/error/warning colours once already:
 * the stylesheet had the rules and the bundle shipped them, but the lookup
 * could never reach them.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const CSS_RULE_CONFIG = path.join(ROOT, 'tools/rspack/base.config.js');

function jsFilesImportingCssModules() {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.name.endsWith('.js') &&
        !entry.name.endsWith('.test.js')
      ) {
        out.push(full);
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  walk(path.join(ROOT, 'shared'));
  return out;
}

const IMPORT_CSS = /import\s+(\w+)\s+from\s+['"][^'"]+\.css['"]/;

describe('CSS module class names', () => {
  it('leaves css-loader on its camel-case-only default', () => {
    // If someone sets exportLocalsConvention, the rule below stops being the
    // right one and this test should be revisited rather than deleted.
    const config = fs.readFileSync(CSS_RULE_CONFIG, 'utf8');
    expect(config).toContain('esModule: false');
    expect(config).not.toContain('exportLocalsConvention');
  });

  it('never reads a class through a name the bundle cannot export', () => {
    const offenders = [];

    for (const file of jsFilesImportingCssModules()) {
      const text = fs.readFileSync(file, 'utf8');
      const imported = text.match(IMPORT_CSS);
      if (!imported) continue;
      const ident = imported[1];

      // `s['some-class']` — a dash means the key is not what was exported.
      const dashed = new RegExp(
        `\\b${ident}\\[\\s*['"]([^'"]*-[^'"]*)['"]\\s*\\]`,
        'g',
      );
      for (const match of text.matchAll(dashed)) {
        offenders.push(
          `${path.relative(ROOT, file)}: ${ident}['${match[1]}'] — ` +
            'exported as camelCase only',
        );
      }

      // `s[`variant-${x}`]` — the built name is unknowable, and it also hides
      // the class from css-modules/no-unused-class, which is how three
      // missing Toast variants went unnoticed. Use an explicit lookup table.
      const dynamic = new RegExp(`\\b${ident}\\[\\s*\`[^\`]*\`\\s*\\]`, 'g');
      for (const match of text.matchAll(dynamic)) {
        offenders.push(
          `${path.relative(ROOT, file)}: ${match[0]} — ` +
            'build a { key: s.name } table instead',
        );
      }
    }

    expect(offenders).toEqual([]);
  });
});
