/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Auto-discovered route: POST /api/webhooks/:provider
 * File: [provider]/_route.js = /api/webhooks/:provider
 *
 * Inbound webhook endpoint for 3rd-party services.
 *
 * Flow:
 * 1. Check provider is registered → 404 if not
 * 2. Read signature from configured header → 401 if missing
 * 3. Verify HMAC signature against secret → 401 if invalid
 * 4. Respond 202 Accepted immediately (fire-and-forget)
 * 5. Dispatch to registered handler(s) asynchronously
 *
 * Bypasses auth middleware — webhooks use HMAC signature verification instead.
 */

export const middleware = false;

// POST /api/webhooks/:provider
export function post(req, res) {
  const http = req.app.get('http');
  const webhook = req.app.get('webhook');
  const { provider } = req.params;

  // 1. Check provider exists
  if (!webhook.hasHandler(provider)) {
    return http.sendNotFound(res, `Unknown provider: ${provider}`);
  }

  // 2. Get provider config and read signature header
  const config = webhook.getProviderConfig(provider);
  const signatureRaw = req.headers[config.signatureHeader];

  if (!signatureRaw) {
    return http.sendUnauthorized(res, 'Missing webhook signature');
  }

  // 3. Parse and verify HMAC signature
  const { algorithm, signature } = webhook.parseSignatureHeader(signatureRaw);
  const isValid = webhook.verifySignature(
    req.body,
    signature,
    config.secret,
    algorithm,
  );

  if (!isValid) {
    return http.sendUnauthorized(res, 'Invalid webhook signature');
  }

  // 4. Respond 202 Accepted immediately (fire-and-forget)
  http.sendSuccess(res, { message: `Webhook accepted: ${provider}` });

  // 5. Dispatch asynchronously — do NOT await
  const context = {
    headers: req.headers,
    query: req.query,
    ip: req.ip,
  };

  webhook.dispatch(provider, req.body, context).catch(error => {
    console.error(
      `[Webhook] Async handler error for ${provider}:`,
      error.message,
    );
  });
}
