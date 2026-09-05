/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { handleIPC } from './extension.controller.js';

jest.mock('../services/extension.service.js', () => ({}));

function build({
  authenticated = false,
  meta = {},
  hasHook = true,
  invoke = async () => ({ handled: true, value: 'pong', extensionId: 'ext1' }),
} = {}) {
  const http = {
    sendError: jest.fn(),
    sendUnauthorized: jest.fn(),
    sendSuccess: jest.fn(),
    sendServerError: jest.fn(),
  };
  const registry = {
    hasHandler: jest.fn(() => hasHook),
    getHandlerMeta: jest.fn(() => meta),
    invokeHandler: jest.fn(invoke),
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
    expect(registry.invokeHandler).not.toHaveBeenCalled();
  });

  it('allows authenticated callers for a private hook', async () => {
    const { req, res, http, registry } = build({ authenticated: true });
    await handleIPC(req, res);
    expect(registry.invokeHandler).toHaveBeenCalledWith(
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

describe('handleIPC handler failures', () => {
  it('reports 502 when the handler throws an unstructured error', async () => {
    const { req, res, http } = build({
      authenticated: true,
      invoke: async () => {
        throw new Error('database socket closed at 10.0.0.4');
      },
    });
    await handleIPC(req, res);

    expect(http.sendSuccess).not.toHaveBeenCalled();
    const [, message, status] = http.sendError.mock.calls[0];
    expect(status).toBe(502);
    // The internal detail must not reach the client
    expect(message).not.toContain('10.0.0.4');
    expect(message).toContain('ping');
  });

  it('honours a status the handler declared deliberately', async () => {
    const { req, res, http } = build({
      authenticated: true,
      invoke: async () => {
        const error = new Error('Quota exceeded for this workspace');
        error.status = 429;
        error.code = 'E_QUOTA';
        throw error;
      },
    });
    await handleIPC(req, res);

    const [, message, status, , meta] = http.sendError.mock.calls[0];
    expect(status).toBe(429);
    expect(message).toBe('Quota exceeded for this workspace');
    expect(meta).toEqual(
      expect.objectContaining({ action: 'ping', code: 'E_QUOTA' }),
    );
  });

  it('ignores a nonsensical status from the handler', async () => {
    const { req, res, http } = build({
      authenticated: true,
      invoke: async () => {
        const error = new Error('nope');
        error.status = 200;
        throw error;
      },
    });
    await handleIPC(req, res);
    expect(http.sendError.mock.calls[0][2]).toBe(502);
  });

  it('treats an undefined answer as success, not as a failure', async () => {
    const { req, res, http } = build({
      authenticated: true,
      invoke: async () => ({ handled: true, value: undefined }),
    });
    await handleIPC(req, res);
    expect(http.sendSuccess).toHaveBeenCalledWith(res, null);
    expect(http.sendError).not.toHaveBeenCalled();
  });

  it('preserves a falsy but real answer', async () => {
    const { req, res, http } = build({
      authenticated: true,
      invoke: async () => ({ handled: true, value: 0 }),
    });
    await handleIPC(req, res);
    expect(http.sendSuccess).toHaveBeenCalledWith(res, 0);
  });

  it('returns 404 when the handler vanished after the hasHandler check', async () => {
    const { req, res, http } = build({
      authenticated: true,
      invoke: async () => ({ handled: false, value: undefined }),
    });
    await handleIPC(req, res);
    expect(http.sendError).toHaveBeenCalledWith(
      res,
      expect.stringContaining('No IPC handler'),
      404,
    );
  });
});
