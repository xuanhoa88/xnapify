import hook, { createFactory, HookChannel } from './index';

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
  });

  describe('Factory', () => {
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
  });

  describe('Default Export', () => {
    test('should be a callable factory', () => {
      const ch = hook('default-test');
      expect(ch).toBeInstanceOf(HookChannel);
    });
  });
});
