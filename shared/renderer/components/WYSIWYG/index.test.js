/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 *
 * @jest-environment jsdom
 */

/* global jest */

import fs from 'fs';
import path from 'path';

import { act } from 'react';

import { createRoot } from 'react-dom/client';

// The real editor drags in TipTap/ProseMirror/KaTeX; the lazy boundary is what
// is under test, so the chunk behind it is stubbed out.
jest.mock('./WYSIWYG.js', () => ({
  __esModule: true,
  default: function Editor() {
    return null;
  },
}));

describe('WYSIWYG lazy boundary', () => {
  let container;
  let root;

  /*
   * `lazy()` memoises the resolved chunk on the module instance, so a second
   * test importing the same instance would never suspend and would never
   * render the fallback. Each test gets a fresh module registry instead.
   */
  const freshWYSIWYG = () => {
    jest.resetModules();

    return require('./index.js').default;
  };

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  const fallback = () => container.querySelector('[data-wysiwyg-loading]');

  it('reserves space in the fallback when the caller passes no className', async () => {
    // PersonalInfoCard.js renders `<Form.WYSIWYG>` with no className. A
    // fallback that leaned on the caller's class for its height would be a
    // zero-height box here, and the form would jump by the editor's full
    // height when the chunk lands.
    const Lazy = freshWYSIWYG();
    act(() => {
      root.render(<Lazy />);
    });

    expect(fallback()).not.toBeNull();
    expect(fallback().querySelector('.reservedSpace')).not.toBeNull();

    // Let the stubbed chunk settle inside act() so React does not warn.
    await act(async () => {});
  });

  it('keeps the caller className alongside the reserved space', async () => {
    const Lazy = freshWYSIWYG();
    act(() => {
      root.render(<Lazy className='contentField' />);
    });

    expect(fallback().className).toBe('contentField');
    expect(fallback().querySelector('.reservedSpace')).not.toBeNull();

    await act(async () => {});
  });

  it('gives the spacer a real height in the stylesheet', () => {
    // The reservation is only as good as the rule behind the class name.
    const css = fs.readFileSync(
      path.join(__dirname, 'Placeholder.css'),
      'utf8',
    );
    expect(css).toMatch(/\.reservedSpace\s*\{[^}]*height:\s*\d+px/);
  });
});
