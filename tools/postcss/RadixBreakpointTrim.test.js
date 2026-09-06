/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import postcss from 'postcss';

import plugin, {
  RADIX_BREAKPOINTS,
  collectUsedBreakpoints,
} from './RadixBreakpointTrim.js';

/** Build a throwaway project tree: { 'src/a.js': '…' } → absolute root. */
function makeTree(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'radix-trim-'));
  for (const [relative, contents] of Object.entries(files)) {
    const full = path.join(root, relative);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, contents, 'utf8');
  }
  return root;
}

const roots = [];

afterAll(() => {
  roots.forEach(root => fs.rmSync(root, { recursive: true, force: true }));
});

function tree(files) {
  const root = makeTree(files);
  roots.push(root);
  return root;
}

/** A Radix responsive variant block, as emitted for `<Grid columns={{…}}>`. */
function radixBlock(name) {
  return `@media (min-width: ${RADIX_BREAKPOINTS[name]}px) { .${name}\\:rt-r-gtc-4 { grid-template-columns: repeat(4, 1fr); } }`;
}

describe('collectUsedBreakpoints', () => {
  it('finds breakpoints used in a responsive prop', () => {
    const root = tree({
      'src/Page.js': "<Grid columns={{ initial: '1', md: '2' }} />",
      'shared/Card.js': "<Flex direction={{ initial: 'column', sm: 'row' }} />",
    });

    expect(collectUsedBreakpoints({ cwd: root }).sort()).toEqual(['md', 'sm']);
  });

  it('finds a breakpoint written across several lines', () => {
    const root = tree({
      'src/Page.js': [
        '<Grid',
        '  columns={{',
        "    initial: '1',",
        "    xl: '4',",
        '  }}',
        '/>',
      ].join('\n'),
    });

    expect(collectUsedBreakpoints({ cwd: root })).toEqual(['xl']);
  });

  it('does not count Tailwind variants inside a className string', () => {
    const root = tree({
      'src/Page.js': '<div className="grid md:flex lg:hidden xl:block" />',
    });

    expect(collectUsedBreakpoints({ cwd: root })).toEqual([]);
  });

  it('reports null when there is nothing to scan', () => {
    const root = tree({ 'README.txt': 'no source here' });

    expect(collectUsedBreakpoints({ cwd: root })).toBeNull();
  });
});

describe('radix-breakpoint-trim', () => {
  const run = (css, options) =>
    postcss([plugin(options)]).process(css, { from: undefined }).css;

  it('drops variant blocks for breakpoints nothing uses', () => {
    const css = radixBlock('xl');

    expect(run(css, { keep: ['sm', 'md', 'lg'] })).toBe('');
  });

  // Regression: the keep-set used to be a hardcoded ['sm','md','lg'], so a
  // component that started using `xl` compiled clean and then rendered wrong
  // above 1640px. The set is derived from the source tree instead.
  it('keeps a breakpoint a component has started using', () => {
    const root = tree({
      'src/Page.js': "<Grid columns={{ initial: '1', xl: '4' }} />",
    });
    const css = radixBlock('xl');

    expect(run(css, { cwd: root })).toBe(css);
  });

  it('still trims breakpoints the source tree does not mention', () => {
    const root = tree({
      'src/Page.js': "<Grid columns={{ initial: '1', md: '2' }} />",
    });

    expect(run(radixBlock('xl'), { cwd: root })).toBe('');
    expect(run(radixBlock('md'), { cwd: root })).toBe(radixBlock('md'));
  });

  it('trims nothing when the source scan comes up empty', () => {
    const root = tree({ 'README.txt': 'no source here' });
    const css = radixBlock('xl');

    expect(run(css, { cwd: root })).toBe(css);
  });

  it('leaves an application media query at the same width alone', () => {
    const root = tree({
      'src/Page.js': "<Grid columns={{ initial: '1', md: '2' }} />",
    });
    const css = `@media (min-width: ${RADIX_BREAKPOINTS.xl}px) { .hero { display: none; } }`;

    expect(run(css, { cwd: root })).toBe(css);
  });
});
