/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 *
 * @jest-environment jsdom
 */

/* global jest */

import { act, createRef } from 'react';

import i18n from 'i18next';
import { createRoot } from 'react-dom/client';

import Toast from './index.js';

const EXIT_ANIMATION_MS = 200;

describe('Toast', () => {
  let container;
  let root;
  let ref;

  beforeEach(() => {
    jest.useFakeTimers();
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    ref = createRef();
    root = createRoot(container);
    act(() => {
      root.render(<Toast ref={ref} />);
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    jest.useRealTimers();
  });

  const text = () => container.textContent;
  // Both live region wrappers are always mounted; only the card comes and goes.
  const card = () => container.querySelector('[class*="toastCard"]');
  const polite = () => container.querySelector('[aria-live="polite"]');
  const assertive = () => container.querySelector('[aria-live="assertive"]');

  it('mounts both live regions before any message is shown', () => {
    expect(card()).toBeNull();
    expect(polite()).not.toBeNull();
    expect(assertive()).not.toBeNull();
    expect(polite().getAttribute('role')).toBe('status');
    expect(assertive().getAttribute('role')).toBe('alert');
  });

  it('defaults to the bottom-right corner', () => {
    expect(polite().className).toContain('placementBottomRight');
    expect(assertive().className).toContain('placementBottomRight');
  });

  it('places the toast in the corner the caller asks for', () => {
    act(() => {
      root.render(<Toast ref={ref} placement='top-left' />);
    });
    expect(polite().className).toContain('placementTopLeft');
    expect(assertive().className).toContain('placementTopLeft');
  });

  it('carries the variant class that supplies the card background', () => {
    // Without it `--toast-bg` is undefined, `background-color: var(--toast-bg)`
    // is invalid at computed-value time and the card paints transparent.
    act(() => {
      ref.current.success('Saved');
    });
    expect(card().className).toContain('variantSuccess');
  });

  it('shows a message and auto-dismisses it after the duration', () => {
    act(() => {
      ref.current.success('Saved', { duration: 1000 });
    });
    expect(text()).toContain('Saved');

    act(() => {
      jest.advanceTimersByTime(1000 + EXIT_ANIMATION_MS);
    });
    expect(card()).toBeNull();
    expect(text()).not.toContain('Saved');
  });

  it('announces errors in the assertive region, leaving the polite one empty', () => {
    // The politeness of a region must never change after it is mounted: a
    // region re-registered in the same commit that inserts its content is not
    // reliably announced. The card moves between regions instead.
    act(() => {
      ref.current.error('Boom');
    });
    expect(assertive().textContent).toContain('Boom');
    expect(polite().textContent).toBe('');
    expect(polite().getAttribute('aria-live')).toBe('polite');
    expect(assertive().getAttribute('aria-live')).toBe('assertive');
  });

  it('announces warnings assertively and success politely', () => {
    act(() => {
      ref.current.warning('Careful');
    });
    expect(assertive().textContent).toContain('Careful');

    act(() => {
      ref.current.success('Saved');
    });
    expect(polite().textContent).toContain('Saved');
    expect(assertive().textContent).toBe('');
  });

  it('translates the close button label instead of hardcoding English', () => {
    i18n.addResourceBundle(
      'en-US',
      'common',
      { components: { toast: { close: 'Dismiss it' } } },
      true,
      true,
    );

    act(() => {
      ref.current.info('Hello');
    });

    const button = container.querySelector('button[aria-label]');
    expect(button.getAttribute('aria-label')).toBe('Dismiss it');

    i18n.removeResourceBundle('en-US', 'common');
  });

  it('keeps a message that arrives during the previous exit animation', () => {
    act(() => {
      ref.current.success('First', { duration: 1000 });
    });

    // Auto-dismiss starts: the exit animation is now in flight.
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(text()).toContain('First');

    // A second message lands before the exit animation finishes.
    act(() => {
      jest.advanceTimersByTime(EXIT_ANIMATION_MS / 2);
      ref.current.error('Second');
    });
    expect(text()).toContain('Second');

    // The first toast's exit timer must not tear down the new message.
    act(() => {
      jest.advanceTimersByTime(EXIT_ANIMATION_MS);
    });
    expect(text()).toContain('Second');
  });

  it('honours duration: 0 as a message that never auto-dismisses', () => {
    act(() => {
      ref.current.error('Sticky', { duration: 0 });
    });

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(text()).toContain('Sticky');
  });

  it('schedules no exit animation when there is nothing to hide', () => {
    // hide() on an idle toast used to arm a 200ms timer that only ever set
    // 'hidden' to 'hidden' — and that was still pending across an unmount.
    act(() => {
      ref.current.hide();
    });
    expect(jest.getTimerCount()).toBe(0);

    // Same once a toast has finished dismissing itself.
    act(() => {
      ref.current.success('Saved', { duration: 1000 });
    });
    act(() => {
      jest.advanceTimersByTime(1000 + EXIT_ANIMATION_MS);
    });
    expect(card()).toBeNull();

    act(() => {
      ref.current.hide();
      ref.current.hide();
    });
    expect(jest.getTimerCount()).toBe(0);
  });

  it('leaves no pending timers behind after unmount', () => {
    act(() => {
      ref.current.info('Bye');
    });
    act(() => {
      root.unmount();
    });
    expect(jest.getTimerCount()).toBe(0);

    // afterEach unmounts again; make that a no-op.
    root = { unmount: () => {} };
  });
});
