/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Remove Radix Themes responsive variants for breakpoints the application
 * never uses.
 *
 * Radix regenerates every utility prop at five breakpoints, which is 380 KB
 * of the emitted stylesheet, about 40% of the whole file. A prop is only
 * reachable at a breakpoint if some component passes a responsive object
 * naming it, as in `columns={{ initial: '1', md: '2' }}`. Breakpoints that
 * appear in no such object can never match.
 *
 * The plugin is deliberately conservative. It only removes a media block when
 * *every* rule inside it is a Radix responsive variant, recognised by the
 * escaped breakpoint prefix Radix generates (`.md\:rt-r-…`). An application
 * media query at the same width, or a Radix block that also carries something
 * else, is left untouched.
 *
 * The keep-set is derived by scanning the source tree, not hardcoded: a
 * hardcoded list goes stale the moment someone writes a new responsive prop,
 * and the failure mode is a component that renders wrong at that width with
 * nothing in the build to say why.
 *
 * @see shared/renderer/app.global.css for the matching colour-scale subset
 */

import fs from 'fs';
import path from 'path';

/**
 * Radix Themes breakpoint names and their min-widths.
 * Mirrors `@radix-ui/themes/src/styles/breakpoints.css`.
 */
export const RADIX_BREAKPOINTS = Object.freeze({
  xs: 520,
  sm: 768,
  md: 1024,
  lg: 1280,
  xl: 1640,
});

/** Directories scanned for responsive props, relative to the project root. */
const SOURCE_ROOTS = Object.freeze(['src', 'shared']);

/** Directories never worth walking into. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.cache',
  '.xnapify',
  'build',
  'dist',
  'release',
  'out',
  'coverage',
]);

/** Source files that can contain a responsive prop. */
const SOURCE_FILE = /\.[cm]?[jt]sx?$/;

/**
 * Matches a Radix breakpoint used as an object-literal key, which is the only
 * shape a responsive prop takes: `{ initial: '1', md: '2' }`, across lines or
 * not. Anchoring on `{` or `,` is what keeps Tailwind's `md:flex` inside a
 * `className` string from counting — there the name is preceded by
 * whitespace or a quote, never by an object delimiter.
 */
const RESPONSIVE_KEY = new RegExp(
  `[{,]\\s*(${Object.keys(RADIX_BREAKPOINTS).join('|')})\\s*:`,
  'g',
);

/**
 * Collect every source file under a directory.
 *
 * @param {string} dir - Directory to walk
 * @param {string[]} out - Accumulator
 */
function collectSourceFiles(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return; // Missing or unreadable root — the caller treats that as "unknown"
  }

  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectSourceFiles(full, out);
    } else if (SOURCE_FILE.test(entry.name)) {
      out.push(full);
    }
  }
}

/**
 * Breakpoints referenced by a responsive prop anywhere in the source tree.
 *
 * Errs towards keeping: an unrecognised usage costs a few unused kilobytes,
 * while a missed one silently breaks the layout at that width.
 *
 * @param {Object} [options]
 * @param {string} [options.cwd] - Project root
 * @param {string[]} [options.roots] - Directories to scan, relative to cwd
 * @returns {string[]|null} Breakpoint names, or null when nothing was scanned
 */
export function collectUsedBreakpoints({
  cwd = process.cwd(),
  roots = SOURCE_ROOTS,
} = {}) {
  const files = [];
  for (const root of roots) {
    collectSourceFiles(path.resolve(cwd, root), files);
  }

  // Nothing to go on. Reporting null rather than an empty set stops the
  // caller from trimming every breakpoint on the strength of a failed scan.
  if (files.length === 0) return null;

  const used = new Set();
  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    for (const match of content.matchAll(RESPONSIVE_KEY)) {
      used.add(match[1]);
    }
  }

  return Array.from(used);
}

/**
 * The scan walks the whole source tree, and the PostCSS config factory runs
 * once per stylesheet. Memoise per project root so the cost is paid once.
 * @type {Map<string, string[]>}
 */
const keepCache = new Map();

/**
 * @param {string} cwd - Project root
 * @returns {string[]} Breakpoint names to preserve
 */
function resolveKeep(cwd) {
  if (!keepCache.has(cwd)) {
    const used = collectUsedBreakpoints({ cwd });
    // A scan that found no source files must not trim anything.
    keepCache.set(cwd, used === null ? Object.keys(RADIX_BREAKPOINTS) : used);
  }
  return keepCache.get(cwd);
}

/**
 * Parse the min-width, in pixels, out of a media query parameter list.
 * Handles both the classic `(min-width: 768px)` form and the range form
 * `(width >= 768px)` that some toolchains normalise to.
 *
 * @param {string} params - At-rule params
 * @returns {number|null} Width in pixels, or null if not a min-width query
 */
function parseMinWidth(params) {
  const classic = params.match(/\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)/i);
  if (classic) return parseFloat(classic[1]);

  const range = params.match(/\(\s*width\s*>=\s*(\d+(?:\.\d+)?)px\s*\)/i);
  if (range) return parseFloat(range[1]);

  return null;
}

/**
 * Whether every rule under this at-rule is a Radix responsive variant for
 * the given breakpoint. Empty blocks return false so nothing is removed on
 * the strength of having found nothing.
 *
 * @param {import('postcss').AtRule} atRule - Media at-rule
 * @param {string} name - Breakpoint name, e.g. 'xl'
 * @returns {boolean}
 */
function containsOnlyVariantsOf(atRule, name) {
  // Radix escapes the colon in the generated class: `.xl\:rt-r-size-1`
  const prefix = `.${name}\\:`;
  let seen = 0;
  let foreign = false;

  atRule.walkRules(rule => {
    seen += 1;
    if (!rule.selector.includes(prefix)) foreign = true;
  });

  return seen > 0 && !foreign;
}

/**
 * @param {Object} [options]
 * @param {string[]} [options.keep] - Breakpoint names to preserve; derived
 *   from the source tree when omitted
 * @param {string} [options.cwd] - Project root used for that derivation
 * @returns {import('postcss').Plugin}
 */
const plugin = (options = {}) => {
  const keep = new Set(
    options.keep || resolveKeep(options.cwd ?? process.cwd()),
  );
  const drop = Object.entries(RADIX_BREAKPOINTS).filter(
    ([name]) => !keep.has(name),
  );

  return {
    postcssPlugin: 'radix-breakpoint-trim',
    AtRule: {
      media(atRule) {
        if (drop.length === 0) return;

        const width = parseMinWidth(atRule.params);
        if (width === null) return;

        const match = drop.find(([, px]) => px === width);
        if (!match) return;

        if (containsOnlyVariantsOf(atRule, match[0])) {
          atRule.remove();
        }
      },
    },
  };
};

plugin.postcss = true;

export default plugin;
