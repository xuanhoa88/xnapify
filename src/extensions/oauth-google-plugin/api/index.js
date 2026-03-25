/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const TAG = '[OAuth Google]';

export default {
  async boot({ container }) {
    const clientID = process.env.RSK_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.RSK_GOOGLE_CLIENT_SECRET;

    if (!clientID || !clientSecret) {
      console.warn(
        `${TAG} ⚠️ RSK_GOOGLE_CLIENT_ID / RSK_GOOGLE_CLIENT_SECRET not set — skipping`,
      );
      return;
    }

    const appUrl = process.env.RSK_APP_URL || 'http://localhost:1337';
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
