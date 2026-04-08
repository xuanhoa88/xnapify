import { createFactory } from '@shared/api/engines/config/factory';
import container from '@shared/container';

// Notice: In the real app, we bootstrap via `src/bootstrap/api/index.js`
// For testing, we just import factory and assume autoloader registers it.
// Here we manually register it to simulate the DI container setup if bootstrap isn't run.

describe('Extension Config Integration', () => {
  beforeAll(() => {
    container.instance('config', createFactory());
  });

  test('extension can obtain namespaced config without touching core', async () => {
    const extCfg = container.resolve('config').withNamespace('EXT');
    await extCfg.set('FOO', 'extFoo');

    expect(await extCfg.use('FOO')).toBe('extFoo');

    const coreCfg = container.resolve('config');
    expect(await coreCfg.get('EXT_FOO')).toBeUndefined();
  });
});
