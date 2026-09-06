/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Guards the hand-maintained Radix colour subset in app.global.css.
 *
 * `styles.css` was replaced with a per-scale import list to cut two thirds of
 * the stylesheet. That makes the file a whitelist, and a whitelist that drifts
 * fails *silently*: a component asking for `var(--teal-3)` when teal was never
 * imported produces a declaration that is invalid at computed-value time, so
 * the property is unset, nothing is logged, and the only symptom is a control
 * rendered in the wrong colour. This test converts that into a build failure
 * naming the file and the scale.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const GLOBAL_CSS = path.join(ROOT, 'shared/renderer/app.global.css');
const SCALE_DIR = path.join(
  ROOT,
  'node_modules/@radix-ui/themes/tokens/colors',
);

/** Every colour scale Radix Themes ships, read from the package itself. */
function radixScales() {
  return fs
    .readdirSync(SCALE_DIR)
    .filter(f => f.endsWith('.css'))
    .map(f => path.basename(f, '.css'));
}

/** The scales app.global.css actually imports. */
function importedScales() {
  const css = fs.readFileSync(GLOBAL_CSS, 'utf8');
  return new Set(
    [...css.matchAll(/tokens\/colors\/([a-z]+)\.css/g)].map(m => m[1]),
  );
}

function sourceFiles() {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        /\.(css|js)$/.test(entry.name) &&
        !/\.test\.js$/.test(entry.name)
      ) {
        out.push(full);
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  walk(path.join(ROOT, 'shared'));
  return out;
}

/**
 * Every scale a file reaches for, via either route into the token:
 *   - a custom property: `var(--teal-3)`, and Tailwind v4's `bg-(--teal-3)`
 *   - a Radix `color` prop: `color="teal"`, `color={cond ? 'indigo' : 'teal'}`
 */
function scalesUsedIn(text, scales) {
  const used = new Set();

  for (const scale of scales) {
    if (new RegExp(`--${scale}-a?\\d`).test(text)) used.add(scale);
  }

  const colorProps = [
    ...text.matchAll(/color=(?:\{([^}]*)\}|(['"])([a-z]+)\2)/g),
  ];
  for (const match of colorProps) {
    const literals = match[1]
      ? [...match[1].matchAll(/['"]([a-z]+)['"]/g)].map(m => m[1])
      : [match[3]];
    for (const literal of literals) {
      if (scales.includes(literal)) used.add(literal);
    }
  }

  return used;
}

describe('Radix colour subset in app.global.css', () => {
  const scales = radixScales();

  it('reads the scale list from the installed Radix package', () => {
    expect(scales).toContain('teal');
    expect(scales.length).toBeGreaterThan(20);
  });

  it('imports every colour scale the application actually uses', () => {
    const imported = importedScales();
    const offenders = [];

    for (const file of sourceFiles()) {
      const text = fs.readFileSync(file, 'utf8');
      for (const scale of scalesUsedIn(text, scales)) {
        if (!imported.has(scale)) {
          offenders.push(`${path.relative(ROOT, file)} uses "${scale}"`);
        }
      }
    }

    expect(
      offenders,
      // Jest prints the array; the fix is always the same one line.
    ).toEqual([]);
  });

  it('does not import scales nothing references', () => {
    // Keeps the subset honest in the other direction, so the saving is real.
    const imported = importedScales();
    const used = new Set(['slate']); // Radix's auto gray for the indigo accent

    for (const file of sourceFiles()) {
      const text = fs.readFileSync(file, 'utf8');
      for (const scale of scalesUsedIn(text, scales)) used.add(scale);
    }

    const dead = [...imported].filter(s => !used.has(s));
    expect(dead).toEqual([]);
  });
});
