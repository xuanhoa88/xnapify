/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createFactory } from './factory';

export { default as MemoryAdapter } from './adapters/memory';
export { default as FileAdapter } from './adapters/file';
export { default as DatabaseAdapter } from './adapters/database';

export { createFactory };

// Create a default config instance
const config = createFactory();

export default config;
