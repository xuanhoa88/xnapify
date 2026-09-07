/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Guards the two CSS animation mistakes that ship silently.
 *
 * 1. A dangling animation name. CSS Modules scopes every name it finds in an
 *    `animation` shorthand, so `animation: pulse 1.5s infinite` in a module
 *    that never defines `@keyframes pulse` is rewritten to a hashed name that
 *    nothing defines. It does not fall back to a global keyframe and it does
 *    not warn — the element simply never animates. That is exactly what
 *    happened to the four extension-card skeletons, and it survived to
 *    production undetected.
 *
 * 2. A keyframe that animates a layout or heavy-paint property. `transform`
 *    and `opacity` are handled on the compositor; `width`, `box-shadow`,
 *    `background-position` and `filter` are not, so animating them costs a
 *    relayout or a full repaint on every frame for as long as the animation
 *    runs — which, for the `infinite` ones, is forever.
 *
 * Both are invisible in review and invisible at runtime, so they are asserted
 * here instead.
 */

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

/**
 * Properties that cannot be animated on the compositor. Animating any of
 * these in a @keyframes block means layout or paint work on every frame.
 */
const NON_COMPOSITED = [
  'width',
  'height',
  'top',
  'left',
  'right',
  'bottom',
  'inset',
  'margin',
  'padding',
  'font-size',
  'line-height',
  'border-width',
  'flex-basis',
  'box-shadow',
  'background-position',
  'background-size',
  'filter',
  'backdrop-filter',
  'clip-path',
];

/** Words that may appear in an `animation` shorthand but are not its name. */
const SHORTHAND_KEYWORDS = new Set([
  'normal',
  'reverse',
  'alternate',
  'alternate-reverse',
  'none',
  'forwards',
  'backwards',
  'both',
  'running',
  'paused',
  'infinite',
  'linear',
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'step-start',
  'step-end',
  'initial',
  'inherit',
  'unset',
  'revert',
  'important',
]);

/** Every first-party stylesheet, module and global alike. */
function styleSheets() {
  const out = [];
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith('.css')) {
        out.push(full);
      }
    }
  };
  walk(path.join(ROOT, 'src'));
  walk(path.join(ROOT, 'shared'));
  return out;
}

const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** `@keyframes foo { … }` names defined in this file. */
function definedNames(css) {
  return new Set(
    [...css.matchAll(/@keyframes\s+([A-Za-z_][\w-]*)/g)].map(m => m[1]),
  );
}

/**
 * Animation names this file references, via either `animation-name` or the
 * name slot of an `animation` shorthand.
 */
function referencedNames(css) {
  const names = new Set();

  for (const m of css.matchAll(/animation-name\s*:\s*([^;}]+)/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .replace(/!important$/, '')
        .trim();
      if (name && !SHORTHAND_KEYWORDS.has(name)) names.add(name);
    }
  }

  for (const m of css.matchAll(/(?:^|[;{\s])animation\s*:\s*([^;}]+)/g)) {
    for (const part of m[1].split(',')) {
      // Drop functional values (cubic-bezier(…), steps(…), var(…)) whole.
      const tokens = part
        .replace(/[a-z-]+\([^)]*\)/gi, ' ')
        .trim()
        .split(/\s+/);
      for (const token of tokens) {
        const t = token.replace(/!important$/, '');
        if (!t) continue;
        if (SHORTHAND_KEYWORDS.has(t)) continue;
        if (/^-?[\d.]+m?s$/.test(t)) continue; // duration / delay
        if (/^-?[\d.]+$/.test(t)) continue; // iteration count
        if (!/^[A-Za-z_][\w-]*$/.test(t)) continue;
        names.add(t);
        break; // the name is the first non-keyword token
      }
    }
  }

  return names;
}

/** The body of every `@keyframes` block in this file, keyed by name. */
function keyframeBodies(css) {
  const blocks = [];
  const re = /@keyframes\s+([A-Za-z_][\w-]*)\s*\{/g;
  let match;
  while ((match = re.exec(css)) !== null) {
    let depth = 1;
    let i = re.lastIndex;
    while (i < css.length && depth > 0) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') depth -= 1;
      i += 1;
    }
    blocks.push({ name: match[1], body: css.slice(re.lastIndex, i - 1) });
  }
  return blocks;
}

const sheets = styleSheets().map(file => ({
  file: path.relative(ROOT, file),
  css: stripComments(fs.readFileSync(file, 'utf8')),
}));

describe('CSS animations', () => {
  it('finds stylesheets to check', () => {
    expect(sheets.length).toBeGreaterThan(50);
  });

  /*
   * `.global.css` files are exempt from the scoping rule: their names are not
   * hashed, and they may reference keyframes that Tailwind emits (`spin`,
   * `pulse`) which are not visible in this source tree.
   */
  it('resolves every animation name inside the module that uses it', () => {
    const dangling = [];

    for (const { file, css } of sheets) {
      if (file.endsWith('.global.css')) continue;
      const defined = definedNames(css);
      for (const name of referencedNames(css)) {
        if (!defined.has(name)) dangling.push(`${file} → "${name}"`);
      }
    }

    expect(dangling).toEqual([]);
  });

  it('animates only compositor-friendly properties', () => {
    const offenders = [];

    for (const { file, css } of sheets) {
      for (const { name, body } of keyframeBodies(css)) {
        for (const prop of NON_COMPOSITED) {
          const re = new RegExp(`(?:^|[;{\\s])${prop}\\s*:`, 'i');
          if (re.test(body)) {
            offenders.push(`${file} → @keyframes ${name} animates "${prop}"`);
          }
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
