/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import os from 'os';

import {
  getClusterWorkerCount,
  getWorkerIndex,
  isClusterWorker,
  isSingletonWorker,
} from './runtime.js';

describe('runtime topology helpers', () => {
  test('defaults to a single process', () => {
    expect(getClusterWorkerCount({})).toBe(1);
    expect(getClusterWorkerCount({ XNAPIFY_CLUSTER_WORKERS: '' })).toBe(1);
    expect(getClusterWorkerCount({ XNAPIFY_CLUSTER_WORKERS: '1' })).toBe(1);
    expect(getClusterWorkerCount({ XNAPIFY_CLUSTER_WORKERS: 'nope' })).toBe(1);
    expect(getClusterWorkerCount({ XNAPIFY_CLUSTER_WORKERS: '0' })).toBe(1);
  });

  test('parses explicit worker counts and auto', () => {
    expect(getClusterWorkerCount({ XNAPIFY_CLUSTER_WORKERS: '4' })).toBe(4);
    const cpus =
      typeof os.availableParallelism === 'function'
        ? os.availableParallelism()
        : os.cpus().length;
    expect(getClusterWorkerCount({ XNAPIFY_CLUSTER_WORKERS: 'auto' })).toBe(
      Math.max(1, cpus),
    );
  });

  test('identifies cluster workers and the singleton worker', () => {
    expect(isClusterWorker({})).toBe(false);
    expect(isSingletonWorker({})).toBe(true);

    expect(isClusterWorker({ XNAPIFY_WORKER_INDEX: '0' })).toBe(true);
    expect(getWorkerIndex({ XNAPIFY_WORKER_INDEX: '0' })).toBe(0);
    expect(isSingletonWorker({ XNAPIFY_WORKER_INDEX: '0' })).toBe(true);

    expect(getWorkerIndex({ XNAPIFY_WORKER_INDEX: '3' })).toBe(3);
    expect(isSingletonWorker({ XNAPIFY_WORKER_INDEX: '3' })).toBe(false);
  });
});
