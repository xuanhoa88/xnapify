/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// eslint-disable-next-line import/no-unresolved
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';

const TAG = '[OAuth Microsoft]';

export default {
  async boot({ container }) {
    const clientID = process.env.XNAPIFY_MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.XNAPIFY_MICROSOFT_CLIENT_KEY;

    if (!clientID || !clientSecret) {
      console.warn(
        `${TAG} ⚠️ XNAPIFY_MICROSOFT_CLIENT_ID / XNAPIFY_MICROSOFT_CLIENT_KEY not set — skipping`,
      );
      return;
    }

    const appUrl =
      process.env.XNAPIFY_PUBLIC_APP_URL || 'http://localhost:1337';
    const oauth = container.resolve('oauth');

    oauth.registerProvider('microsoft', {
      strategy: new MicrosoftStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: `${appUrl}/api/auth/oauth/microsoft/callback`,
          scope: ['user.read'],
          passReqToCallback: false,
        },
        (accessToken, refreshToken, profile, done) => done(null, profile),
      ),
      scope: ['user.read'],
    });

    console.info(`${TAG} ✅ Initialized`);
  },

  async shutdown({ container }) {
    const oauth = container.resolve('oauth');
    if (oauth && oauth.hasProvider('microsoft')) {
      oauth.unregisterProvider('microsoft');
    }
    console.info(`${TAG} 🗑️ Destroyed`);
  },
};
