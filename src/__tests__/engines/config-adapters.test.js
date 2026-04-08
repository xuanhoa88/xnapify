import fs from 'fs/promises';

import { engines } from '@shared/api';
import DbAdapter from '@shared/api/engines/config/adapters/database';
import FileAdapter from '@shared/api/engines/config/adapters/file';
import MemoryAdapter from '@shared/api/engines/config/adapters/memory';
import ConfigParam from '@shared/api/engines/config/models/ConfigParam';

const { db } = engines;

describe('Config Adapters', () => {
  describe('MemoryAdapter', () => {
    test('crud operations', async () => {
      const adapter = new MemoryAdapter();
      await adapter.set('NS', 'KEY', 'memory-val');
      expect(await adapter.get('NS', 'KEY')).toBe('memory-val');
      await adapter.delete('NS', 'KEY');
      expect(await adapter.get('NS', 'KEY')).toBeUndefined();
    });

    test('delete all by namespace', async () => {
      const adapter = new MemoryAdapter();
      await adapter.set('NS', 'K1', 'v1');
      await adapter.set('NS', 'K2', 'v2');
      await adapter.set('OTHER', 'K1', 'v3');
      await adapter.delete('NS'); // no key
      expect(await adapter.get('NS', 'K1')).toBeUndefined();
      expect(await adapter.get('NS', 'K2')).toBeUndefined();
      expect(await adapter.get('OTHER', 'K1')).toBe('v3');
    });
  });

  describe('FileAdapter', () => {
    const testFile = './test-config.json';

    afterEach(async () => {
      try {
        await fs.unlink(testFile);
      } catch {
        // TODO
      }
    });

    test('atomic crud operations', async () => {
      const adapter = new FileAdapter(testFile);

      // Initial create
      await adapter.set('NS', 'KEY', 'file-val');

      // Read hitting memory layer instantly
      expect(await adapter.get('NS', 'KEY')).toBe('file-val');

      // Read hitting disk via a new instance to simulate cold boot
      const coldAdapter = new FileAdapter(testFile);
      expect(await coldAdapter.get('NS', 'KEY')).toBe('file-val');

      // Update
      await adapter.set('NS', 'KEY', 'updated-val');

      // Read hitting disk via a new instance
      const coldAdapter2 = new FileAdapter(testFile);
      expect(await coldAdapter2.get('NS', 'KEY')).toBe('updated-val');

      // Delete specific key
      await adapter.delete('NS', 'KEY');
      expect(await adapter.get('NS', 'KEY')).toBeUndefined();
    });

    test('delete all by namespace', async () => {
      const adapter = new FileAdapter(testFile);
      await adapter.set('NS', 'K1', 'v1');
      await adapter.set('NS', 'K2', 'v2');
      await adapter.set('OTHER', 'K1', 'v3');

      await adapter.delete('NS'); // no key

      const coldAdapter = new FileAdapter(testFile);
      expect(await coldAdapter.get('NS', 'K1')).toBeUndefined();
      expect(await coldAdapter.get('NS', 'K2')).toBeUndefined();
      expect(await coldAdapter.get('OTHER', 'K1')).toBe('v3');
    });
  });

  describe('DbAdapter', () => {
    beforeAll(async () => {
      // In a real test environment with Sequelize, db.connection handles mocking SQLite in memory.
      if (db && db.connection) {
        ConfigParam.initSchema(db.connection);
        await ConfigParam.sync({ force: true });
      }
    });

    test('crud operations against sqlite', async () => {
      if (!db || !db.connection) {
        console.warn(
          'Skipping DbAdapter test: no db.connection found in test env',
        );
        return;
      }

      const adapter = new DbAdapter(); // Uses global ConfigParam
      await adapter.set('NS', 'KEY', 'db-val');
      expect(await adapter.get('NS', 'KEY')).toBe('db-val');
      await adapter.delete('NS', 'KEY');
      expect(await adapter.get('NS', 'KEY')).toBeUndefined();
    });

    test('delete all by namespace', async () => {
      if (!db || !db.connection) return;

      const adapter = new DbAdapter();
      await adapter.set('NS', 'K1', 'v1');
      await adapter.set('NS', 'K2', 'v2');
      await adapter.set('OTHER', 'K1', 'v3');

      await adapter.delete('NS'); // no key

      expect(await adapter.get('NS', 'K1')).toBeUndefined();
      expect(await adapter.get('NS', 'K2')).toBeUndefined();
      expect(await adapter.get('OTHER', 'K1')).toBe('v3');
    });
  });
});
