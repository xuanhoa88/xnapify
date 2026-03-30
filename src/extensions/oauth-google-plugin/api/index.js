/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// eslint-disable-next-line import/no-unresolved
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const TAG = '[OAuth Google]';

export default {
  async boot({ container }) {
    const clientID = process.env.XNAPIFY_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.XNAPIFY_GOOGLE_CLIENT_SECRET;

    if (!clientID || !clientSecret) {
      console.warn(
        `${TAG} ⚠️ XNAPIFY_GOOGLE_CLIENT_ID / XNAPIFY_GOOGLE_CLIENT_SECRET not set — skipping`,
      );
      return;
    }

    const appUrl = process.env.XNAPIFY_APP_URL || 'http://localhost:1337';
    const oauth = container.resolve('oauth');

    oauth.registerProvider('google', {
      strategy: new GoogleStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: `${appUrl}/api/auth/oauth/google/callback`,
          passReqToCallback: false,
        },
        (accessToken, refreshToken, profile, done) => done(null, profile),
      ),
      scope: ['profile', 'email'],
    });

    console.info(`${TAG} ✅ Initialized`);
  },

  async shutdown({ container }) {
    const oauth = container.resolve('oauth');
    if (oauth && oauth.hasProvider('google')) {
      oauth.unregisterProvider('google');
    }
    console.info(`${TAG} 🗑️ Destroyed`);
  },
};
