/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Strategy as GitHubStrategy } from 'passport-github2';

const TAG = '[OAuth GitHub]';

export default {
  async boot(registry, context) {
    const clientID = process.env.RSK_GITHUB_CLIENT_ID;
    const clientSecret = process.env.RSK_GITHUB_CLIENT_SECRET;

    if (!clientID || !clientSecret) {
      console.warn(
        `${TAG} ⚠️ RSK_GITHUB_CLIENT_ID / RSK_GITHUB_CLIENT_SECRET not set — skipping`,
      );
      return;
    }

    const appUrl = process.env.RSK_APP_URL || 'http://localhost:1337';
    const oauth = context.container.resolve('oauth');

    oauth.registerProvider('github', {
      strategy: new GitHubStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: `${appUrl}/api/auth/oauth/github/callback`,
          scope: ['user:email'],
          passReqToCallback: false,
        },
        (accessToken, refreshToken, profile, done) => done(null, profile),
      ),
      scope: ['user:email'],
    });

    console.info(`${TAG} ✅ Initialized`);
  },

  async shutdown(registry, context) {
    const oauth = context.container.resolve('oauth');
    if (oauth && oauth.hasProvider('github')) {
      oauth.unregisterProvider('github');
    }
    console.info(`${TAG} 🗑️ Destroyed`);
  },
};
