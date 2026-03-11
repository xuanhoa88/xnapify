/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as FacebookStrategy } from 'passport-facebook';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as MicrosoftStrategy } from 'passport-microsoft';

/**
 * Configure Passport strategies for OAuth.
 * Since this is an API, we do not use session serialization.
 * Only the specific strategies are registered if their credentials are provided.
 */
export function configurePassport() {
  const commonCallback = (accessToken, refreshToken, profile, done) => {
    // The profile object contains all the needed information.
    // We pass it to the route handler via the done callback.
    return done(null, profile);
  };

  // Get app URL from environment variable
  const appUrl = process.env['RSK_APP_URL'] || 'http://localhost:1337';

  // Google Strategy
  if (
    process.env.RSK_GOOGLE_CLIENT_ID &&
    process.env.RSK_GOOGLE_CLIENT_SECRET
  ) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.RSK_GOOGLE_CLIENT_ID,
          clientSecret: process.env.RSK_GOOGLE_CLIENT_SECRET,
          callbackURL: `${appUrl}/api/auth/oauth/google/callback`,
          passReqToCallback: false,
        },
        commonCallback,
      ),
    );
  }

  // Facebook Strategy
  if (process.env.RSK_FACEBOOK_APP_ID && process.env.RSK_FACEBOOK_APP_SECRET) {
    passport.use(
      new FacebookStrategy(
        {
          clientID: process.env.RSK_FACEBOOK_APP_ID,
          clientSecret: process.env.RSK_FACEBOOK_APP_SECRET,
          callbackURL: `${appUrl}/api/auth/oauth/facebook/callback`,
          profileFields: ['id', 'emails', 'name', 'picture.type(large)'],
          passReqToCallback: false,
        },
        commonCallback,
      ),
    );
  }

  // GitHub Strategy
  if (
    process.env.RSK_GITHUB_CLIENT_ID &&
    process.env.RSK_GITHUB_CLIENT_SECRET
  ) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.RSK_GITHUB_CLIENT_ID,
          clientSecret: process.env.RSK_GITHUB_CLIENT_SECRET,
          callbackURL: `${appUrl}/api/auth/oauth/github/callback`,
          scope: ['user:email'],
          passReqToCallback: false,
        },
        commonCallback,
      ),
    );
  }

  // Microsoft Strategy
  if (
    process.env.RSK_MICROSOFT_CLIENT_ID &&
    process.env.RSK_MICROSOFT_CLIENT_SECRET
  ) {
    passport.use(
      new MicrosoftStrategy(
        {
          clientID: process.env.RSK_MICROSOFT_CLIENT_ID,
          clientSecret: process.env.RSK_MICROSOFT_CLIENT_SECRET,
          callbackURL: `${appUrl}/api/auth/oauth/microsoft/callback`,
          scope: ['user.read'],
          passReqToCallback: false,
        },
        commonCallback,
      ),
    );
  }

  return passport;
}

export default passport;
