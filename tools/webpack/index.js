/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

const webpackClientConfig = require('./client.config');
const {
  webpackServerConfig,
  SERVER_BUNDLE_PATH: WEBPACK_SERVER_BUNDLE_PATH,
} = require('./server.config');
const browserSyncServer = require('./browserSync/server.config');

module.exports = {
  webpackClientConfig,
  webpackServerConfig,
  WEBPACK_SERVER_BUNDLE_PATH,
  ...browserSyncServer,
};
