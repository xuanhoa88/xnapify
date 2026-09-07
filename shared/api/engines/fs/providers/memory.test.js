/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { ERROR_CODES } from '../utils/index.js';

import { MemoryFilesystemProvider } from './memory.js';

let provider;

beforeEach(async () => {
  provider = new MemoryFilesystemProvider();
  await provider.store('a.txt', Buffer.from('a'));
  await provider.store('b.txt', Buffer.from('b'));
});

describe('MemoryFilesystemProvider overwrite refusal', () => {
  // The operations layer decides between a 409 and a generic 500 by reading
  // `error.code` off what the provider threw (rename.js:66, copy.js:65). The
  // memory provider raised the right code and then re-wrapped it in its own
  // catch-all, so the code never reached the caller and a refused overwrite
  // was reported as an unexplained failure. The local provider deliberately
  // rethrows a FilesystemError untouched for exactly this reason; memory has
  // to agree with it, because tests and dev runs pick their provider freely.
  it('move() surfaces TARGET_EXISTS rather than re-wrapping it', async () => {
    await expect(
      provider.move('a.txt', 'b.txt', { overwrite: false }),
    ).rejects.toMatchObject({ code: ERROR_CODES.TARGET_EXISTS });
  });

  it('copy() surfaces TARGET_EXISTS rather than re-wrapping it', async () => {
    await expect(
      provider.copy('a.txt', 'b.txt', { overwrite: false }),
    ).rejects.toMatchObject({ code: ERROR_CODES.TARGET_EXISTS });
  });

  it('leaves both files in place when it refuses', async () => {
    await provider.move('a.txt', 'b.txt', { overwrite: false }).catch(() => {});
    await expect(provider.exists('a.txt')).resolves.toBe(true);
    await expect(provider.exists('b.txt')).resolves.toBe(true);
  });
});
