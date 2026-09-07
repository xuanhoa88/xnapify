/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { mkdtemp, readdir, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

import { createFactory } from '../factory.js';

import { processRename } from './index.js';

describe('Filesystem Workers', () => {
  let basePath;
  let options;

  beforeEach(async () => {
    basePath = await mkdtemp(path.join(tmpdir(), 'fs-worker-'));
    // A worker builds its own manager, so the provider configuration has to
    // travel in `options` — the caller's factory is out of reach.
    options = { provider: 'local', local: { basePath } };
  });

  afterEach(async () => {
    await rm(basePath, { recursive: true, force: true });
  });

  const seed = async fileNames => {
    for (const fileName of fileNames) {
      await writeFile(path.join(basePath, fileName), fileName);
    }
  };

  const listFiles = async () => (await readdir(basePath)).sort();

  describe('processRename', () => {
    it('should rename every operation in a batch', async () => {
      await seed(['a.txt', 'c.txt', 'e.txt']);

      const result = await processRename(
        [
          { oldName: 'a.txt', newName: 'b.txt' },
          { oldName: 'c.txt', newName: 'd.txt' },
          { oldName: 'e.txt', newName: 'f.txt' },
        ],
        options,
      );

      expect(result.success).toBe(true);
      expect(result.data.successCount).toBe(3);
      expect(result.data.failCount).toBe(0);
      expect(await listFiles()).toEqual(['b.txt', 'd.txt', 'f.txt']);
    });

    it('should rename a single-operation list', async () => {
      await seed(['a.txt']);

      const result = await processRename(
        [{ oldName: 'a.txt', newName: 'b.txt' }],
        options,
      );

      expect(result.success).toBe(true);
      expect(result.data.successCount).toBe(1);
      expect(await listFiles()).toEqual(['b.txt']);
    });

    it('should rename a bare operation object', async () => {
      await seed(['a.txt']);

      const result = await processRename(
        { oldName: 'a.txt', newName: 'b.txt' },
        options,
      );

      expect(result.success).toBe(true);
      expect(result.data.successCount).toBe(1);
      expect(await listFiles()).toEqual(['b.txt']);
    });

    it('should rename 3+ files when the service auto-selects the worker', async () => {
      await seed(['a.txt', 'c.txt', 'e.txt']);
      const fs = createFactory(options);

      // No `useWorker`: 3 operations cross the auto-worker threshold, which is
      // the default path for any multi-file rename.
      const result = await fs.rename(
        [
          { oldName: 'a.txt', newName: 'b.txt' },
          { oldName: 'c.txt', newName: 'd.txt' },
          { oldName: 'e.txt', newName: 'f.txt' },
        ],
        options,
      );

      expect(result.success).toBe(true);
      expect(result.data.successCount).toBe(3);
      expect(await listFiles()).toEqual(['b.txt', 'd.txt', 'f.txt']);
    });
  });
});
