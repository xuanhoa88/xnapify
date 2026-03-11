/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import passport from 'passport';

export const get = [
  function oauthInitiate(req, res, next) {
    const { provider } = req.params;

    try {
      const scopes = {
        google: ['profile', 'email'],
        facebook: ['public_profile', 'email'],
        github: ['user:email'],
        microsoft: ['user.read'],
      };

      const scope = scopes[provider] || [];

      return passport.authenticate(provider, { session: false, scope })(
        req,
        res,
        next,
      );
    } catch (error) {
      if (
        error.message &&
        error.message.includes('Unknown authentication strategy')
      ) {
        const http = req.app.get('http');
        return http.sendError(
          res,
          `OAuth provider '${provider}' is not configured or unknown`,
          404,
        );
      }
      return next(error);
    }
  },
];
