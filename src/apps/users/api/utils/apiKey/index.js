/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { verifyActiveSession } from '@shared/api/engines/auth/revocation.js';

function apiKeyError(message, name, code) {
  const error = new Error(message);
  error.name = name;
  error.code = code;
  error.status = 401;
  return error;
}

// Handle API Key strategy for request authentication
export const authenticate = async (req, { token, jwt }) => {
  // Verify explicitly for API key flow (checks signature + expiration)
  const verifiedPayload = jwt.verifyToken(token);

  // API Key flow
  const container = req.app.get('container');
  const { UserApiKey, User } = container.resolve('models');
  const apiKey = await UserApiKey.findOne({
    where: {
      id: verifiedPayload.jti,
      user_id: verifiedPayload.id,
      is_active: true,
    },
  });

  if (!apiKey) {
    throw apiKeyError(
      'Invalid or revoked API Key',
      'InvalidApiKeyError',
      'API_KEY_INVALID',
    );
  }

  // Check expiration if DB has it (JWT exp is already checked by verifyToken)
  if (apiKey.expires_at && new Date() > apiKey.expires_at) {
    throw apiKeyError(
      'API Key expired',
      'ApiKeyExpiredError',
      'API_KEY_EXPIRED',
    );
  }

  // An API key is only as valid as the account behind it. This path bypasses
  // requireAuth's session checks entirely, so the owner's state has to be
  // re-read here or a deactivated / locked / deleted user keeps full access
  // for the key's remaining lifetime (up to a year).
  if (User) {
    const user = await User.findByPk(verifiedPayload.id, {
      attributes: [
        'id',
        'is_active',
        'is_locked',
        'locked_until',
        'token_version',
      ],
    });

    const lockedByTime =
      user && user.locked_until && user.locked_until.getTime() > Date.now();

    if (!user || !user.is_active || user.is_locked || lockedByTime) {
      throw apiKeyError(
        'API Key owner is no longer active',
        'InvalidApiKeyError',
        'API_KEY_OWNER_INACTIVE',
      );
    }
  }

  // Keys minted with a `ver` claim also honour the durable token_version, so
  // "sign out everywhere" reaches them the moment it happens.
  await verifyActiveSession(container, verifiedPayload);

  // Update last used (fire and forget to not block response time too much, or await)
  await apiKey.update({ last_used_at: new Date() });

  // Return the authentication result (mutate req for hook)
  req.user = verifiedPayload;
  req.authMethod = 'api_key';
  req.apiKey = apiKey;
};
