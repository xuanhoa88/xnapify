/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import passport from 'passport';

export const get = [
  async function oauthCallbackMiddleware(req, res, next) {
    const { provider } = req.params;

    // Get app URL from environment variable
    const appUrl = process.env.XNAPIFY_PUBLIC_APP_URL;

    try {
      // Materialise the strategy (lazy factory) before authenticating
      const oauth = req.app.get('container').resolve('oauth');
      if (oauth) {
        await oauth.ensureStrategy(provider);
      }

      passport.authenticate(
        provider,
        { session: false, failureRedirect: `${appUrl}/?oauth=error` },
        (err, user, info) => {
          if (err) {
            console.error('Passport Auth Error:', err);
            return next(err);
          }
          if (!user) {
            console.error('Passport Auth Failed - No User. Info:', info);
            return res.redirect(`${appUrl}/?oauth=error`);
          }
          // Attach user to req
          req.user = user;
          next();
        },
      )(req, res, next);
    } catch (error) {
      if (
        error.message &&
        error.message.includes('Unknown authentication strategy')
      ) {
        const http = req.app.get('container').resolve('http');
        return http.sendError(
          res,
          `OAuth provider '${provider}' is not configured or unknown`,
          404,
        );
      }
      return next(error);
    }
  },
  function oauthCallbackController(req, ...args) {
    const { auth } = req.app.get('container').resolve('users:controllers');
    return auth.oauthCallback(req, ...args);
  },
];
