/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export { default as webpackClientConfig } from './client.config';
export {
  SERVER_BUNDLE_PATH as WEBPACK_SERVER_BUNDLE_PATH,
  default as webpackServerConfig,
} from './server.config';
export * from './browserSync/server.config';
