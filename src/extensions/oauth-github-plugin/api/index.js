/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// eslint-disable-next-line import/no-unresolved
import { Strategy as GitHubStrategy } from 'passport-github2';

const TAG = '[OAuth GitHub]';

const seedsContext = require.context(
  './database/seeds',
  false,
  /\.[cm]?[jt]s$/i,
);

export default {
  seeds: () => seedsContext,
  async boot({ container }) {
    const clientID = process.env.XNAPIFY_GITHUB_CLIENT_ID;
    const clientSecret = process.env.XNAPIFY_GITHUB_CLIENT_KEY;

    if (!clientID || !clientSecret) {
      console.warn(
        `${TAG} ⚠️ XNAPIFY_GITHUB_CLIENT_ID / XNAPIFY_GITHUB_CLIENT_KEY not set — skipping`,
      );
      return;
    }

    const oauth = container.resolve('oauth');

    oauth.registerProvider('github', {
      strategy: new GitHubStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: `${process.env.XNAPIFY_PUBLIC_APP_URL}/api/auth/oauth/github/callback`,
          scope: ['user:email'],
          passReqToCallback: false,
        },
        (accessToken, refreshToken, profile, done) => done(null, profile),
      ),
      scope: ['user:email'],
    });

    console.info(`${TAG} ✅ Initialized`);
  },

  async shutdown({ container }) {
    const oauth = container.resolve('oauth');
    if (oauth && oauth.hasProvider('github')) {
      oauth.unregisterProvider('github');
    }
    console.info(`${TAG} 🗑️ Destroyed`);
  },
};
