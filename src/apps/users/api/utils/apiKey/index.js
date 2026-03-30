/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// Handle API Key strategy for request authentication
export const authenticate = async (req, { token, jwt }) => {
  // Verify explicitly for API key flow (checks signature + expiration)
  const verifiedPayload = jwt.verifyToken(token);

  // API Key flow
  const { UserApiKey } = req.app.get('container').resolve('models');
  const apiKey = await UserApiKey.findOne({
    where: {
      id: verifiedPayload.jti,
      user_id: verifiedPayload.id,
      is_active: true,
    },
  });

  if (!apiKey) {
    const error = new Error('Invalid or revoked API Key');
    error.name = 'InvalidApiKeyError';
    error.status = 401;
    error.code = 'API_KEY_INVALID';
    throw error;
  }

  // Check expiration if DB has it (JWT exp is already checked by verifyToken)
  if (apiKey.expires_at && new Date() > apiKey.expires_at) {
    const error = new Error('API Key expired');
    error.name = 'ApiKeyExpiredError';
    error.status = 401;
    error.code = 'API_KEY_EXPIRED';
    throw error;
  }

  // Update last used (fire and forget to not block response time too much, or await)
  await apiKey.update({ last_used_at: new Date() });

  // Return the authentication result (mutate req for hook)
  req.user = verifiedPayload;
  req.authMethod = 'api_key';
  req.apiKey = apiKey;
};
