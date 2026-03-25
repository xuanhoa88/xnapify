/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Strategy as MicrosoftStrategy } from 'passport-microsoft';

const TAG = '[OAuth Microsoft]';

export default {
  async boot({ container }) {
    const clientID = process.env.RSK_MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.RSK_MICROSOFT_CLIENT_SECRET;

    if (!clientID || !clientSecret) {
      console.warn(
        `${TAG} ⚠️ RSK_MICROSOFT_CLIENT_ID / RSK_MICROSOFT_CLIENT_SECRET not set — skipping`,
      );
      return;
    }

    const appUrl = process.env.RSK_APP_URL || 'http://localhost:1337';
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
