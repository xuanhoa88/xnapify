/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export const post = [
  function register(req, ...args) {
    const { auth } = req.app.get('container').resolve('users:controllers');
    return auth.register(req, ...args);
  },
];
