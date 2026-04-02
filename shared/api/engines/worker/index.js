/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createFactory, WorkerPoolManager } from './factory';

// Named exports for custom instances and type references
export { createFactory, WorkerPoolManager };

// Re-export errors
export { WorkerError } from './errors';

// Default singleton — auto-registered on DI container as 'worker'
const engine = createFactory();
export default engine;
