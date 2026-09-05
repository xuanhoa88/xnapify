/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import { health, ready } from './health.controller.js';

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
}

function makeReq({ db, extension }) {
  return {
    id: 'req-1',
    app: {
      get: key =>
        key === 'container'
          ? {
              resolve: name => {
                if (name === 'db') return db;
                if (name === 'extension') return extension;
                throw new Error(`unbound ${name}`);
              },
            }
          : null,
    },
  };
}

const okDb = { connection: { authenticate: jest.fn().mockResolvedValue() } };
const extensionWith = metadata => ({
  getAllExtensions: () => metadata.filter(m => m.state === 'active'),
  getAllExtensionMetadata: () => metadata,
});

describe('health.controller', () => {
  it('health reports liveness', () => {
    const res = makeRes();
    health({ id: 'r' }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ok', requestId: 'r' }),
    );
  });

  it('ready is 200/ready when everything loaded', async () => {
    const res = makeRes();
    await ready(
      makeReq({
        db: okDb,
        extension: extensionWith([{ id: 'a', state: 'active' }]),
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('ready');
    expect(body.checks.extensions).toEqual({
      status: 'ok',
      loaded: 1,
      failed: [],
    });
  });

  it('ready is 200/degraded and names extensions that failed to load', async () => {
    const res = makeRes();
    await ready(
      makeReq({
        db: okDb,
        extension: extensionWith([
          { id: 'a', state: 'active' },
          {
            id: 'b',
            state: 'failed',
            manifest: { name: '@acme/b' },
            error: new Error('boom'),
          },
        ]),
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('degraded');
    expect(body.checks.extensions.failed).toEqual([
      { id: 'b', name: '@acme/b', error: 'boom' },
    ]);
  });

  it('ready is 503/unavailable when the database is down', async () => {
    const res = makeRes();
    const db = {
      connection: {
        authenticate: jest.fn().mockRejectedValue(new Error('down')),
      },
    };
    await ready(makeReq({ db, extension: extensionWith([]) }), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].status).toBe('unavailable');
  });
});
