/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/* global jest */

import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import flowSplitter from './flowSplitter.js';

let userDir;
let RED;

/**
 * A Node-RED double exposing just what the extension touches. The handler is
 * invoked directly rather than through `events.emit`, because EventEmitter
 * discards the promise an async listener returns and the assertions need to
 * observe a completed run.
 */
function createRED(dir) {
  return {
    log: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
    settings: { userDir: dir, flowFile: 'flows.json' },
    events: {
      on: jest.fn(),
      removeListener: jest.fn(),
    },
    nodes: { loadFlows: jest.fn(async () => {}) },
  };
}

const deploy = flows =>
  RED.events.xnapifyFlowSplitterHandler({ config: { flows } });

const boot = () => RED.events.xnapifyFlowSplitterHandler({ config: {} });

const listSplit = async subdir =>
  (await fsp.readdir(path.join(userDir, 'src', subdir))).sort();

const tab = (id, label) => ({ id, type: 'tab', label });
const node = (id, z) => ({ id, type: 'inject', z, name: id });

beforeEach(async () => {
  userDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-flow-splitter-'));
  RED = createRED(userDir);
  flowSplitter(RED);
});

afterEach(async () => {
  await fsp.rm(userDir, { recursive: true, force: true });
});

describe('splitFlows', () => {
  it('removes the file left behind when a tab is renamed', async () => {
    await deploy([tab('t1', 'Ingest'), node('n1', 't1')]);
    expect(await listSplit('tabs')).toEqual(['ingest.json']);

    await deploy([tab('t1', 'Ingest v2'), node('n1', 't1')]);

    expect(await listSplit('tabs')).toEqual(['ingest-v2.json']);
  });

  it('removes the file for a tab that was deleted', async () => {
    await deploy([
      tab('t1', 'Ingest'),
      node('n1', 't1'),
      tab('t2', 'Reports'),
      node('n2', 't2'),
    ]);
    expect(await listSplit('tabs')).toEqual(['ingest.json', 'reports.json']);

    await deploy([tab('t1', 'Ingest'), node('n1', 't1')]);

    expect(await listSplit('tabs')).toEqual(['ingest.json']);
  });

  it('removes _global.json once the last config node is deleted', async () => {
    await deploy([
      tab('t1', 'Ingest'),
      { id: 'c1', type: 'mqtt-broker', name: 'broker' },
    ]);
    expect(await listSplit('config-nodes')).toEqual(['_global.json']);

    await deploy([tab('t1', 'Ingest')]);

    expect(await listSplit('config-nodes')).toEqual([]);
  });

  it('keeps files unrelated to the configured format', async () => {
    await deploy([tab('t1', 'Ingest')]);
    await fsp.writeFile(path.join(userDir, 'src', 'tabs', 'README.md'), '# hi');

    await deploy([tab('t1', 'Ingest')]);

    expect(await listSplit('tabs')).toEqual(['README.md', 'ingest.json']);
  });

  it('does not resurrect a deleted tab on the next boot', async () => {
    await deploy([
      tab('t1', 'Ingest'),
      node('n1', 't1'),
      tab('t2', 'Reports'),
      node('n2', 't2'),
    ]);
    await deploy([tab('t1', 'Ingest'), node('n1', 't1')]);

    await boot();

    const rebuilt = JSON.parse(
      await fsp.readFile(path.join(userDir, 'flows.json'), 'utf8'),
    );
    expect(rebuilt.map(n => n.id).sort()).toEqual(['n1', 't1']);
  });
});

describe('rebuildFlows', () => {
  it('refuses to rebuild when two files claim the same node id', async () => {
    await deploy([tab('t1', 'Ingest'), node('n1', 't1')]);
    // A merge that resolves a rename by keeping both sides is the ordinary way
    // a committed split tree ends up with two files holding one node id.
    const tabsDir = path.join(userDir, 'src', 'tabs');
    await fsp.copyFile(
      path.join(tabsDir, 'ingest.json'),
      path.join(tabsDir, 'ingest-v2.json'),
    );

    await boot();

    expect(RED.nodes.loadFlows).not.toHaveBeenCalled();
    await expect(
      fsp.access(path.join(userDir, 'flows.json')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect(RED.log.error).toHaveBeenCalledWith(expect.stringContaining('n1'));
  });
});
