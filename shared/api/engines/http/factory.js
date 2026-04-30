/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { register } from '../../shutdown';

import * as constants from './constants';
import * as errors from './errors';
import * as request from './request';
import * as response from './response';

const DEFAULT_CONFIG = {};

class HttpEngine {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Attach stateless utility functions to the engine instance directly
    // This maintains 100% backward compatibility for existing controllers
    // calling http.sendSuccess(), http.getPagination(), etc.
    Object.assign(this, constants);
    Object.assign(this, request);
    Object.assign(this, response);
    Object.assign(this, errors);
  }

  async cleanup() {
    // The HTTP engine is stateless and has no active promises or connections
    console.info('[Http Engine] Cleaned up');
  }
}

export function createFactory(config) {
  const engine = new HttpEngine(config);

  // Register with centralized shutdown coordinator
  register('http', () => engine.cleanup(), 20);

  return engine;
}
