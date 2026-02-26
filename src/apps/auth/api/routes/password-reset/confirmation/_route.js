/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export const post = [
  function resetPasswordConfirmation(req, ...args) {
    const { auth } = req.app.get('container').resolve('users:controllers');
    return auth.resetPasswordConfirmation(req, ...args);
  },
];
