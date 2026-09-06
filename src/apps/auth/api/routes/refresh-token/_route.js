/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// `key` is the bucket identity — without it every route declaring the same
// numbers would share one counter.
export const useRateLimit = {
  key: 'auth:refresh-token',
  max: 60,
  windowMs: 15 * 60_000,
};

export const post = [
  function refreshToken(req, ...args) {
    const { auth } = req.app.get('container').resolve('users:controllers');
    return auth.refreshToken(req, ...args);
  },
];
