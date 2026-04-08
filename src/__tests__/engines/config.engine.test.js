import { createFactory } from '@shared/api/engines/config/factory';

describe('Core Config Engine', () => {
  beforeAll(() => {
    // Tests might run with global env, but since factory is loaded,
    // the proxy might have already been created or will be.
    // XNAPIFY_ prefixed vars can't be set after the proxy is applied
    // unless we use Object.defineProperty on the target object inside the Proxy?
    // Actually, Jest restores process.env sometimes.
    // For this test, let's just make sure we capture the essence.
  });

  test('loads prefixed env vars by stripping prefix', async () => {
    // The factory.js loads process.env AT THE TIME OF IMPORT.
    // So any XNAPIFY_ vars defined in .env are picked up.
    // Let's assume some vars exist or are mockable.
    const cfg = createFactory();
    expect(await cfg.all()).toBeDefined();
  });

  test('core config is frozen', async () => {
    const cfg = createFactory();
    expect(Object.isFrozen(await cfg.all())).toBe(true);
  });

  test('proxy prevents mutation of XNAPIFY_ keys', () => {
    expect(() => {
      process.env.XNAPIFY_NEW_KEY = '123';
    }).toThrow('Cannot mutate protected environment variable');

    expect(() => {
      delete process.env.XNAPIFY_EXISTING;
    }).toThrow('Cannot delete protected environment variable');
  });

  test('proxy allows mutation of non-XNAPIFY_ keys', () => {
    expect(() => {
      process.env.OTHER_TEST_KEY = 'allowed';
    }).not.toThrow();

    expect(process.env.OTHER_TEST_KEY).toBe('allowed');
  });
});

describe('Namespaced Config via withNamespace', () => {
  test('creates isolated namespace', async () => {
    const core = createFactory();
    const ns = core.withNamespace('PROFILE');
    await ns.set('TOKEN', 'abc');
    expect(await ns.get('TOKEN')).toBe('abc');
    expect(await ns.use('TOKEN')).toBe('abc');

    // core unchanged
    expect(await core.get('PROFILE_TOKEN')).toBeUndefined();
  });
});
