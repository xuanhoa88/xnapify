/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// eslint-disable-next-line import/no-unresolved
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const TAG = '[OAuth Google]';

const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

export default {
  seeds: () => seedsContext,
  async boot({ container }) {
    const oauth = container.resolve('oauth');

    // Register a lazy strategy factory — credentials are resolved
    // from the settings service at first request, not at boot time.
    // This eliminates boot-order timing issues and allows admin
    // settings changes to take effect without a server restart.
    oauth.registerProvider('google', {
      strategy: async () => {
        const clientID = process.env.XNAPIFY_GOOGLE_CLIENT_ID;
        const clientSecret = process.env.XNAPIFY_GOOGLE_CLIENT_KEY;

        if (!clientID || !clientSecret) {
          console.warn(
            `${TAG} ⚠️ XNAPIFY_GOOGLE_CLIENT_ID / XNAPIFY_GOOGLE_CLIENT_KEY not set`,
          );
          return null;
        }

        console.info(`${TAG} ✅ Strategy created`);

        return new GoogleStrategy(
          {
            clientID,
            clientSecret,
            callbackURL: `${process.env.XNAPIFY_PUBLIC_APP_URL}/api/auth/oauth/google/callback`,
            passReqToCallback: false,
          },
          (accessToken, refreshToken, profile, done) => done(null, profile),
        );
      },
      scope: ['profile', 'email'],
    });

    console.info(`${TAG} ✅ Registered (lazy strategy)`);
  },

  async shutdown({ container }) {
    const oauth = container.resolve('oauth');
    if (oauth && oauth.hasProvider('google')) {
      oauth.unregisterProvider('google');
    }
    console.info(`${TAG} 🗑️ Destroyed`);
  },
};
