/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

function makeRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    setHeader: jest.fn(),
  };
}

function makeReq({ db, extension, models }) {
  return {
    id: 'req-1',
    app: {
      get: key =>
        key === 'container'
          ? {
              resolve: name => {
                if (name === 'db') return db;
                if (name === 'extension') return extension;
                if (name === 'models') {
                  if (!models) throw new Error('unbound models');
                  return models;
                }
                throw new Error(`unbound ${name}`);
              },
            }
          : null,
    },
  };
}

const makeDb = (tables = ['users']) => ({
  connection: {
    authenticate: jest.fn().mockResolvedValue(),
    getQueryInterface: () => ({
      showAllTables: jest.fn().mockResolvedValue(tables),
    }),
  },
});

const modelsWith = (map = { User: 'users' }) => ({
  names: () => Object.keys(map),
  get: name => ({ tableName: map[name] }),
});

const extensionWith = metadata => ({
  getAllExtensions: () => metadata.filter(m => m.state === 'active'),
  getAllExtensionMetadata: () => metadata,
});

describe('health.controller', () => {
  let health;
  let ready;
  let beginDraining;

  beforeEach(() => {
    // The controller caches a successful schema check and reads the shared
    // drain flag, both module state — reload for every case.
    jest.resetModules();
    ({ health, ready } = require('./health.controller.js'));
    ({ beginDraining } = require('@shared/utils/lifecycle.js'));
  });

  it('health reports liveness', () => {
    const res = makeRes();
    health({ id: 'r' }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ok', requestId: 'r' }),
    );
  });

  it('health stays 200 while the process is draining', () => {
    beginDraining();
    const res = makeRes();
    health({ id: 'r' }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('ready is 200/ready when everything loaded', async () => {
    const res = makeRes();
    await ready(
      makeReq({
        db: makeDb(),
        models: modelsWith(),
        extension: extensionWith([{ id: 'a', state: 'active' }]),
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('ready');
    expect(body.checks.schema).toEqual({ status: 'ok' });
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
        db: makeDb(),
        models: modelsWith(),
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
        getQueryInterface: () => ({
          showAllTables: jest.fn().mockRejectedValue(new Error('down')),
        }),
      },
    };
    await ready(makeReq({ db, extension: extensionWith([]) }), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].status).toBe('unavailable');
  });

  it('ready is 503 when the database is reachable but unmigrated', async () => {
    const res = makeRes();
    await ready(
      makeReq({
        // Connection answers, but the tables the models need do not exist.
        db: makeDb(['SequelizeMeta']),
        models: modelsWith({ User: 'users', Setting: 'settings' }),
        extension: extensionWith([]),
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(503);
    const body = res.json.mock.calls[0][0];
    expect(body.status).toBe('unavailable');
    expect(body.checks.database.status).toBe('ok');
    expect(body.checks.schema).toEqual(
      expect.objectContaining({
        status: 'error',
        missing: ['users', 'settings'],
      }),
    );
  });

  it('ready reports schema "unknown" rather than failing when it cannot tell', async () => {
    const res = makeRes();
    await ready(
      makeReq({
        db: makeDb(),
        // No model registry bound — the check is inconclusive, not failing.
        extension: extensionWith([]),
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].checks.schema.status).toBe('unknown');
  });

  it('ready is 503/draining as soon as shutdown begins', async () => {
    beginDraining();
    const res = makeRes();
    const db = makeDb();
    await ready(
      makeReq({ db, models: modelsWith(), extension: extensionWith([]) }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].status).toBe('draining');
    // Nothing is probed once draining — the answer is already decided.
    expect(db.connection.authenticate).not.toHaveBeenCalled();
  });
});
