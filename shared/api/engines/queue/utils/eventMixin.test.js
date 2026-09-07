/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { applyEventMixin } from './eventMixin.js';

function makeEmitter() {
  const target = {};
  applyEventMixin(target);
  return target;
}

let reported;

beforeEach(() => {
  reported = [];
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    reported.push(args);
  });
});

afterEach(() => jest.restoreAllMocks());

describe('applyEventMixin emit', () => {
  it('reports an async handler that rejects instead of leaving it unhandled', async () => {
    // An async handler does not throw — it returns a rejected promise, which
    // the try/catch around the call cannot see. With nothing attached, Node
    // treats it as an uncaughtException and exits, so one failing listener on
    // `failed` (only reached because something already went wrong) took the
    // whole worker down.
    const emitter = makeEmitter();
    const rejection = new Error('listener blew up');
    let settled;
    const handlerDone = new Promise(resolve => {
      settled = resolve;
    });

    emitter.on('failed', async () => {
      try {
        throw rejection;
      } finally {
        setImmediate(settled);
      }
    });

    const unhandled = [];
    const onUnhandled = err => unhandled.push(err);
    process.on('unhandledRejection', onUnhandled);
    try {
      emitter.emit('failed', { id: 1 });
      await handlerDone;
      await new Promise(resolve => setImmediate(resolve));
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }

    expect(unhandled).toEqual([]);
    expect(reported.flat()).toContain(rejection);
  });

  it('still reports a synchronous handler that throws', () => {
    const emitter = makeEmitter();
    const failure = new Error('sync blew up');

    emitter.on('failed', () => {
      throw failure;
    });
    emitter.emit('failed');

    expect(reported.flat()).toContain(failure);
  });

  it('does not let one failing handler stop the ones after it', () => {
    const emitter = makeEmitter();
    const seen = [];

    emitter.on('completed', () => {
      throw new Error('first blew up');
    });
    emitter.on('completed', () => seen.push('second'));
    emitter.emit('completed');

    expect(seen).toEqual(['second']);
  });

  it('delivers arguments to every handler', () => {
    const emitter = makeEmitter();
    const seen = [];

    emitter.on('completed', (a, b) => seen.push([a, b]));
    emitter.emit('completed', 1, 'two');

    expect(seen).toEqual([[1, 'two']]);
  });
});

describe('applyEventMixin registration', () => {
  it('names an unrecognized event instead of dropping it silently', () => {
    // The vocabulary is fixed and internal, so an unrecognized name is always
    // a typo — and the cost of the typo is total: `on()` returned normally,
    // the handler was never stored, and the event it meant to observe fired
    // for the life of the process with nothing listening. Nothing distinguishes
    // that from a listener whose event simply never occurred. Registration
    // stays non-fatal, as it always has; it just stops being invisible.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const emitter = makeEmitter();

    emitter.on('complete', () => {});

    expect(warn).toHaveBeenCalled();
    const said = warn.mock.calls.flat().join(' ');
    expect(said).toMatch(/complete/);
    // The message has to carry the vocabulary, or the reader still has to go
    // and find it before the warning is actionable.
    expect(said).toMatch(/completed/);
  });

  it('names an unrecognized event passed to off() too', () => {
    // Same failure wearing the other face: off() silently does nothing and the
    // handler keeps firing, which reads as a listener that will not detach.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const emitter = makeEmitter();

    emitter.off('complete', () => {});

    expect(warn).toHaveBeenCalled();
  });

  it('stays silent for a recognized event', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const emitter = makeEmitter();

    emitter.on('completed', () => {});
    emitter.off('completed', () => {});

    expect(warn).not.toHaveBeenCalled();
  });
});
