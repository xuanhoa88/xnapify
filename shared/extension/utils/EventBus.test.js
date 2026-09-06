/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import EventBus from './EventBus.js';

describe('EventBus subscription', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus('Test');
  });

  it('rejects a non-function subscriber', () => {
    expect(() => bus.on('e', 'nope')).toThrow(TypeError);
  });

  it('returns an unsubscribe function', async () => {
    const handler = jest.fn();
    const off = bus.on('e', handler);

    off();
    await bus.emit('e', 1);

    expect(handler).not.toHaveBeenCalled();
    expect(bus.count('e')).toBe(0);
  });

  it('deduplicates the same handler', () => {
    const handler = jest.fn();
    bus.on('e', handler);
    bus.on('e', handler);
    expect(bus.count('e')).toBe(1);
  });

  it('off without a handler removes every subscriber for the type', () => {
    bus.on('e', jest.fn());
    bus.on('e', jest.fn());
    bus.off('e');
    expect(bus.count('e')).toBe(0);
  });

  it('off on an unknown type is a no-op', () => {
    expect(() => bus.off('missing', jest.fn())).not.toThrow();
  });
});

describe('EventBus emit', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus('Test');
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('resolves quietly when nothing is subscribed', async () => {
    await expect(bus.emit('e', 1)).resolves.toBeUndefined();
  });

  it('waits for async subscribers before resolving', async () => {
    let settled = false;
    bus.on('e', async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      settled = true;
    });

    await bus.emit('e');

    expect(settled).toBe(true);
  });

  it('runs every subscriber even when one throws', async () => {
    const after = jest.fn();
    bus.on('e', () => {
      throw new Error('boom');
    });
    bus.on('e', after);

    await expect(bus.emit('e')).resolves.toBeUndefined();

    expect(after).toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[Test]'),
      expect.any(Error),
    );
  });

  it('contains an async rejection the same way', async () => {
    const after = jest.fn();
    bus.on('e', async () => {
      throw new Error('boom');
    });
    bus.on('e', after);

    await expect(bus.emit('e')).resolves.toBeUndefined();
    expect(after).toHaveBeenCalled();
  });

  it('lets a subscriber unsubscribe itself during emit', async () => {
    // The listener set is copied before iteration, so a "once" style handler
    // cannot mutate the collection being walked.
    const seen = [];
    const once = () => {
      seen.push('once');
      bus.off('e', once);
    };
    bus.on('e', once);
    bus.on('e', () => seen.push('other'));

    await bus.emit('e');
    await bus.emit('e');

    expect(seen).toEqual(['once', 'other', 'other']);
  });

  it('passes the payload through', async () => {
    const handler = jest.fn();
    bus.on('e', handler);
    await bus.emit('e', { id: 'x' });
    expect(handler).toHaveBeenCalledWith({ id: 'x' });
  });

  it('clear drops every subscriber', async () => {
    const handler = jest.fn();
    bus.on('a', handler);
    bus.on('b', handler);

    bus.clear();
    await bus.emit('a');

    expect(handler).not.toHaveBeenCalled();
  });
});
