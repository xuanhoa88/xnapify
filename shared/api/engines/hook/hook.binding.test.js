import { createFactory } from './factory';

describe('Hook binding', () => {
  test('handlers run with provided context as `this`', async () => {
    const factory = createFactory();
    const ctx = { name: 'appContext' };

    const boundFactory = factory.withContext(ctx);
    const channel = boundFactory('test');

    let called = false;
    channel.on('ping', function (payload) {
      expect(this).toBe(ctx);
      expect(payload).toEqual({ hello: 'world' });
      called = true;
    });

    await channel.emit('ping', { hello: 'world' });
    expect(called).toBe(true);
  });

  test('should allow removing specific handlers from bound wrapper', async () => {
    const factory = createFactory();
    const ctx = { name: 'appContext' };
    const boundFactory = factory.withContext(ctx);
    const channel = boundFactory('test');

    const handlerToKeep = jest.fn();
    const handlerToRemove = jest.fn();

    channel.on('ping', handlerToKeep);
    channel.on('ping', handlerToRemove);

    // Remove only one handler
    channel.off('ping', handlerToRemove);

    await channel.emit('ping', { data: 1 });

    expect(handlerToKeep).toHaveBeenCalledTimes(1);
    expect(handlerToRemove).not.toHaveBeenCalled();

    // Original channel should have exactly 1 handler left
    const baseChannel = factory('test');
    expect(baseChannel.handlers.get('ping').length).toBe(1);
  });

  test('should flawlessly remove handler if registered to multiple events', () => {
    const factory = createFactory();
    const ctx = {};
    const boundFactory = factory.withContext(ctx);
    const channel = boundFactory('test-multi');

    const multiHandler = jest.fn();

    // Register same exact handler reference to two different events
    channel.on('event-a', multiHandler);
    channel.on('event-b', multiHandler);

    // Remove from just one
    channel.off('event-a', multiHandler);

    const baseChannel = factory('test-multi');
    expect(baseChannel.handlers.has('event-a')).toBe(false); // correctly emptied
    expect(baseChannel.handlers.get('event-b').length).toBe(1); // the other is intact
  });

  test('should allow chaining withContext', () => {
    const factory = createFactory();
    const ctx1 = { name: 'A' };
    const ctx2 = { name: 'B' };

    // Test on Channel level
    const ch = factory('test-chain');
    const bound1 = ch.withContext(ctx1);
    const bound2 = bound1.withContext(ctx2);

    // Ensure methods exist
    expect(bound2.on).toBeInstanceOf(Function);
  });
});
