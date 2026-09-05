/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { handleIPC } from './extension.controller.js';

jest.mock('../services/extension.service.js', () => ({}));

function build({ authenticated = false, meta = {}, hasHook = true } = {}) {
  const http = {
    sendError: jest.fn(),
    sendUnauthorized: jest.fn(),
    sendSuccess: jest.fn(),
    sendServerError: jest.fn(),
  };
  const registry = {
    hasHook: jest.fn(() => hasHook),
    getHookMeta: jest.fn(() => meta),
    executeHookParallel: jest.fn(async () => ['pong']),
  };
  const container = {
    resolve: name => {
      if (name === 'http') return http;
      if (name === 'extension') return { registry };
      return null;
    },
  };
  const req = {
    params: { id: 'ext1' },
    body: { action: 'ping', data: { a: 1 } },
    authenticated,
    user: authenticated ? { id: 'u1' } : null,
    app: { get: () => container },
  };
  return { req, res: {}, http, registry };
}

describe('handleIPC authorization', () => {
  it('rejects anonymous callers for a default (private) hook', async () => {
    const { req, res, http, registry } = build();
    await handleIPC(req, res);
    expect(http.sendUnauthorized).toHaveBeenCalledWith(
      res,
      'Authentication required',
    );
    expect(registry.executeHookParallel).not.toHaveBeenCalled();
  });

  it('allows authenticated callers for a private hook', async () => {
    const { req, res, http, registry } = build({ authenticated: true });
    await handleIPC(req, res);
    expect(registry.executeHookParallel).toHaveBeenCalledWith(
      'ipc:ext1:ping',
      { a: 1 },
      expect.objectContaining({ req }),
    );
    expect(http.sendSuccess).toHaveBeenCalledWith(res, 'pong');
  });

  it('allows anonymous callers only when the hook opted in as public', async () => {
    const { req, res, http } = build({ meta: { public: true } });
    await handleIPC(req, res);
    expect(http.sendUnauthorized).not.toHaveBeenCalled();
    expect(http.sendSuccess).toHaveBeenCalledWith(res, 'pong');
  });

  it('returns 404 before any auth check when no handler exists', async () => {
    const { req, res, http } = build({ hasHook: false });
    await handleIPC(req, res);
    expect(http.sendError).toHaveBeenCalledWith(
      res,
      expect.stringContaining('No IPC handler'),
      404,
    );
    expect(http.sendUnauthorized).not.toHaveBeenCalled();
  });
});
