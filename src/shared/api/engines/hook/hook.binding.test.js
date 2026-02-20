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
});
