import hook, {
  createFactory,
  HookChannel,
  InvalidChannelNameError,
  HookAbortError,
} from '.';

describe('Hook Engine', () => {
  describe('HookChannel', () => {
    let channel;

    beforeEach(() => {
      channel = new HookChannel('test');
    });

    test('should execute handlers in priority order', async () => {
      const order = [];

      channel.on('save', async () => order.push('second'), 20);
      channel.on('save', async () => order.push('first'), 1);

      await channel.emit('save');

      expect(order).toEqual(['first', 'second']);
    });

    test('should allow modifying data by reference', async () => {
      channel.on('transform', async data => {
        data.value *= 2;
      });

      const data = { value: 5 };
      await channel.emit('transform', data);

      expect(data.value).toBe(10);
    });

    test('should support chaining', () => {
      const result = channel.on('a', async () => {}).on('b', async () => {});

      expect(result).toBe(channel);
    });

    test('should remove handlers', async () => {
      const handler = jest.fn();
      channel.on('remove-test', handler);
      channel.off('remove-test');

      await channel.emit('remove-test');

      expect(handler).not.toHaveBeenCalled();
    });

    test('should list registered events', () => {
      channel.on('event1', async () => {});
      channel.on('event2', async () => {});

      expect(channel.events).toEqual(['event1', 'event2']);
    });

    test('should not skip handlers if a handler removes itself during emit', async () => {
      const order = [];

      const handlerA = async () => {
        order.push('A');
        channel.off('mutation', handlerA);
      };

      const handlerB = async () => {
        order.push('B');
      };

      channel.on('mutation', handlerA, 1);
      channel.on('mutation', handlerB, 2);

      await channel.emit('mutation');

      expect(order).toEqual(['A', 'B']);
    });

    test('should remove all identical handlers if registered multiple times', async () => {
      let count = 0;
      const handler = async () => count++;

      channel.on('multi', handler, 1);
      channel.on('multi', handler, 2);

      channel.off('multi', handler);

      await channel.emit('multi');

      expect(count).toBe(0);
    });

    test('should execute all handlers even if one throws, then propagate the error', async () => {
      const order = [];

      channel.on(
        'error-test',
        async () => {
          order.push('A');
          throw new Error('Handler A error');
        },
        1,
      );

      channel.on(
        'error-test',
        async () => {
          order.push('B');
        },
        2,
      );

      await expect(channel.emit('error-test')).rejects.toThrow(
        'Handler A error',
      );

      // Despite throwing, B was still executed
      expect(order).toEqual(['A', 'B']);
    });

    test('should throw AggregateError if multiple handlers fail', async () => {
      const order = [];

      channel.on(
        'agg-test',
        async () => {
          order.push('A');
          throw new Error('Error A');
        },
        1,
      );

      channel.on(
        'agg-test',
        async () => {
          order.push('B');
          throw new Error('Error B');
        },
        2,
      );

      try {
        await channel.emit('agg-test');
        // If we reach here, the promise resolved unexpectedly
        throw new Error('Should have thrown');
      } catch (err) {
        // For the unexpected resolution, bubble it
        if (err.message === 'Should have thrown') throw err;

        // Depending on Node version, it might be an AggregateError or standard Error with .errors
        expect(err.errors).toBeDefined();
        expect(err.errors.length).toBe(2);
        expect(err.errors[0].message).toBe('Error A');
        expect(err.errors[1].message).toBe('Error B');
      }

      expect(order).toEqual(['A', 'B']);
    });

    test('should fail fast with invoke()', async () => {
      const order = [];

      channel.on(
        'invoke-test',
        async () => {
          order.push('A');
          throw new Error('Invoke Error A');
        },
        1,
      );

      channel.on(
        'invoke-test',
        async () => {
          order.push('B');
        },
        2,
      );

      await expect(channel.invoke('invoke-test')).rejects.toThrow(
        'Invoke Error A',
      );

      // B should NOT be executed
      expect(order).toEqual(['A']);
    });

    test('should support AbortSignal cancellation', async () => {
      const order = [];
      const controller = new AbortController();

      channel.on(
        'abort-test',
        async () => {
          order.push('A');
          controller.abort(); // abort mid-flight
        },
        1,
      );

      channel.on(
        'abort-test',
        async () => {
          order.push('B');
        },
        2,
      );

      try {
        await channel.emit('abort-test', controller.signal);
      } catch (err) {
        expect(err.name).toBe('AbortError');
      }
      expect(order).toEqual(['A']);
    });

    // --- Edge case tests ---

    test('should resolve immediately when emitting event with no handlers', async () => {
      // No handlers registered for this event
      await expect(channel.emit('no-handlers')).resolves.toBeUndefined();
    });

    test('should resolve immediately when invoking event with no handlers', async () => {
      await expect(channel.invoke('no-handlers')).resolves.toBeUndefined();
    });

    test('should throw AbortError when invoke() detects pre-aborted signal', async () => {
      const controller = new AbortController();
      controller.abort(); // Pre-abort before invoke

      channel.on('abort-invoke', jest.fn());

      await expect(
        channel.invoke('abort-invoke', controller.signal),
      ).rejects.toThrow('Execution aborted');
    });

    test('should throw AbortError on invoke() when signal aborts mid-flight', async () => {
      const order = [];
      const controller = new AbortController();

      channel.on(
        'abort-invoke-mid',
        async () => {
          order.push('A');
          controller.abort();
        },
        1,
      );

      channel.on(
        'abort-invoke-mid',
        async () => {
          order.push('B');
        },
        2,
      );

      try {
        await channel.invoke('abort-invoke-mid', controller.signal);
      } catch (err) {
        expect(err.name).toBe('AbortError');
      }

      // B should NOT be executed — invoke stops at abort
      expect(order).toEqual(['A']);
    });

    test('should clear all handlers on all events when off() is called with no args', async () => {
      const handlerA = jest.fn();
      const handlerB = jest.fn();

      channel.on('event1', handlerA);
      channel.on('event2', handlerB);

      expect(channel.events.length).toBe(2);

      channel.off(); // Clear all

      expect(channel.events).toEqual([]);

      await channel.emit('event1');
      await channel.emit('event2');

      expect(handlerA).not.toHaveBeenCalled();
      expect(handlerB).not.toHaveBeenCalled();
    });

    test('should throw TypeError when handler is not a function', () => {
      expect(() => channel.on('test', 'not-a-function')).toThrow(TypeError);
      expect(() => channel.on('test', null)).toThrow(TypeError);
      expect(() => channel.on('test', 123)).toThrow(TypeError);
    });

    test('should not throw when off() targets a non-existent event', () => {
      expect(() => channel.off('never-registered')).not.toThrow();
    });

    test('should not throw when off() targets non-existent handler on existing event', async () => {
      channel.on('exists', jest.fn());
      const unregistered = jest.fn();

      expect(() => channel.off('exists', unregistered)).not.toThrow();
    });
  });

  describe('Factory', () => {
    test('should reject empty or whitespace channel names', () => {
      const factory = createFactory();
      expect(() => factory('   ')).toThrow(
        'Channel name must be a non-empty string',
      );
      expect(factory.has(' ')).toBe(false);
      expect(factory.remove('\t')).toBe(false);
    });
    test('should create channels via factory call', () => {
      const factory = createFactory();
      const ch = factory('my-channel');

      expect(ch).toBeInstanceOf(HookChannel);
      expect(ch.name).toBe('my-channel');
    });

    test('should return same instance for same name', () => {
      const factory = createFactory();

      expect(factory('test')).toBe(factory('test'));
    });

    test('should track channels', () => {
      const factory = createFactory();
      factory('a');
      factory('b');

      expect(factory.has('a')).toBe(true);
      expect(factory.has('c')).toBe(false);
      expect(factory.getChannelNames()).toEqual(['a', 'b']);
    });

    test('should remove channels', () => {
      const factory = createFactory();
      factory('temp');

      expect(factory.remove('temp')).toBe(true);
      expect(factory.has('temp')).toBe(false);
    });

    test('should cleanup all channels', () => {
      const factory = createFactory();
      factory('x');
      factory('y');

      factory.cleanup();

      expect(factory.getChannelNames()).toEqual([]);
    });

    test('should throw InvalidChannelNameError for invalid names', () => {
      const factory = createFactory();

      try {
        factory('');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidChannelNameError);
        expect(err.code).toBe('ERR_INVALID_CHANNEL_NAME');
        expect(err.statusCode).toBe(400);
      }
    });
  });

  describe('Default Export', () => {
    test('should be a callable factory', () => {
      const ch = hook('default-test');
      expect(ch).toBeInstanceOf(HookChannel);
    });
  });

  describe('Error Classes', () => {
    test('InvalidChannelNameError should have correct properties', () => {
      const err = new InvalidChannelNameError();
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('InvalidChannelNameError');
      expect(err.code).toBe('ERR_INVALID_CHANNEL_NAME');
      expect(err.statusCode).toBe(400);
      expect(err.message).toBe('Channel name must be a non-empty string');
    });

    test('InvalidChannelNameError should accept custom message', () => {
      const err = new InvalidChannelNameError('Custom msg');
      expect(err.message).toBe('Custom msg');
    });

    test('HookAbortError should have correct properties', () => {
      const err = new HookAbortError();
      expect(err).toBeInstanceOf(Error);
      expect(err.name).toBe('AbortError');
      expect(err.code).toBe('ERR_HOOK_ABORTED');
      expect(err.statusCode).toBe(499);
      expect(err.message).toBe('Execution aborted');
    });
  });
});
