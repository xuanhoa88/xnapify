/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Strategy as FacebookStrategy } from 'passport-facebook';

const TAG = '[OAuth Facebook]';

export default {
  async init(registry, context) {
    const clientID = process.env.RSK_FACEBOOK_APP_ID;
    const clientSecret = process.env.RSK_FACEBOOK_APP_SECRET;

    if (!clientID || !clientSecret) {
      console.warn(
        `${TAG} ⚠️ RSK_FACEBOOK_APP_ID / RSK_FACEBOOK_APP_SECRET not set — skipping`,
      );
      return;
    }

    const appUrl = process.env['RSK_APP_URL'] || 'http://localhost:1337';
    const oauth = context.container.resolve('oauth');

    oauth.registerProvider('facebook', {
      strategy: new FacebookStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: `${appUrl}/api/auth/oauth/facebook/callback`,
          profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
          passReqToCallback: false,
        },
        (accessToken, refreshToken, profile, done) => done(null, profile),
      ),
      scope: ['public_profile', 'email'],
    });

    console.info(`${TAG} ✅ Initialized`);
  },

  async destroy(registry, context) {
    const oauth = context.container.resolve('oauth');
    if (oauth && oauth.hasProvider('facebook')) {
      oauth.unregisterProvider('facebook');
    }
    console.info(`${TAG} 🗑️ Destroyed`);
  },
};
