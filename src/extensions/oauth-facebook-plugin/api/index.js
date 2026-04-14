/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// eslint-disable-next-line import/no-unresolved
import { Strategy as FacebookStrategy } from 'passport-facebook';

const TAG = '[OAuth Facebook]';

const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

export default {
  seeds: () => seedsContext,
  async boot({ container }) {
    const oauth = container.resolve('oauth');

    oauth.registerProvider('facebook', {
      strategy: async () => {
        const clientID = process.env.XNAPIFY_FACEBOOK_APP_ID;
        const clientSecret = process.env.XNAPIFY_FACEBOOK_APP_KEY;

        if (!clientID || !clientSecret) {
          console.warn(
            `${TAG} ⚠️ XNAPIFY_FACEBOOK_APP_ID / XNAPIFY_FACEBOOK_APP_KEY not set`,
          );
          return null;
        }

        console.info(`${TAG} ✅ Strategy created`);

        return new FacebookStrategy(
          {
            clientID,
            clientSecret,
            callbackURL: `${process.env.XNAPIFY_PUBLIC_APP_URL}/api/auth/oauth/facebook/callback`,
            profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
            passReqToCallback: false,
          },
          (accessToken, refreshToken, profile, done) => done(null, profile),
        );
      },
      scope: ['public_profile', 'email'],
    });

    console.info(`${TAG} ✅ Registered (lazy strategy)`);
  },

  async shutdown({ container }) {
    const oauth = container.resolve('oauth');
    if (oauth && oauth.hasProvider('facebook')) {
      oauth.unregisterProvider('facebook');
    }
    console.info(`${TAG} 🗑️ Destroyed`);
  },
};
