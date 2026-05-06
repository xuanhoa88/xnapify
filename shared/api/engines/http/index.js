/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createFactory } from './factory.js';

// Constants
export * from './constants.js';

// Response utilities
export * from './response.js';

// Request utilities
export * from './request.js';

// Error handling utilities
export * from './errors.js';

// Export factory for creating instances
export { createFactory };

// Default singleton — auto-registered on DI container
const http = createFactory();
export default http;
