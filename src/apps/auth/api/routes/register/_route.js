/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Strict per-route limit: credential and token endpoints are brute-force targets.
// `key` is the bucket identity — without it every route declaring the same
// numbers would share one counter.
export const useRateLimit = {
  key: 'auth:register',
  max: 10,
  windowMs: 15 * 60_000,
};

export const post = [
  function register(req, ...args) {
    const { auth } = req.app.get('container').resolve('users:controllers');
    return auth.register(req, ...args);
  },
];
