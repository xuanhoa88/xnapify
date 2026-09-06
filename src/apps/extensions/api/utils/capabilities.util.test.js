/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  DEFAULT_EXTENSION_CAPABILITIES,
  PRIVILEGED_CAPABILITIES,
  RESERVED_CAPABILITIES,
} from '@shared/extension/utils/compat.js';

import * as capabilitiesUtil from './capabilities.util.js';
import {
  auditExtensionCapabilities,
  findResolvedBindings,
  getDeclaredCapabilities,
  isCapabilityGranted,
  DEFAULT_CAPABILITIES,
  RESERVED_CAPABILITIES as LOCAL_RESERVED,
} from './capabilities.util.js';

const EXTENSIONS_DIR = path.resolve(process.cwd(), 'src', 'extensions');

describe('capability declarations mirror the runtime contract', () => {
  it('uses the same defaults as the scoped container', () => {
    // These lists are duplicated on purpose — this module has to load from the
    // build task, which runs on plain Node with no `@shared` alias — so the
    // copies need a tripwire the way DIALECT_SCHEMES needed a single home.
    expect([...DEFAULT_CAPABILITIES]).toEqual([
      ...DEFAULT_EXTENSION_CAPABILITIES,
    ]);
    expect([...LOCAL_RESERVED]).toEqual([...RESERVED_CAPABILITIES]);
  });

  it('keeps no diverging copy of the privileged tier', () => {
    // The privileged tier is deliberately NOT duplicated here: it is enforced
    // when capabilities are granted, and this analyzer only answers whether a
    // binding was declared. The day it is mirrored, this fails — turn it into
    // an equality check against compat's list rather than deleting it.
    expect(Object.keys(capabilitiesUtil)).not.toContain(
      'PRIVILEGED_CAPABILITIES',
    );
    // And nothing privileged may hide in the always-on defaults, which would
    // hand it to every extension before the gate is ever consulted.
    for (const capability of PRIVILEGED_CAPABILITIES) {
      expect(DEFAULT_CAPABILITIES).not.toContain(capability);
    }
  });

  it('grants the defaults only when nothing is declared', () => {
    expect(getDeclaredCapabilities({})).toEqual([...DEFAULT_CAPABILITIES]);
    // An explicit empty array is a declaration of "nothing", not a fallback.
    expect(getDeclaredCapabilities({ xnapify: { capabilities: [] } })).toEqual(
      [],
    );
  });

  it('never grants a reserved binding', () => {
    expect(
      getDeclaredCapabilities({
        xnapify: { capabilities: ['jwt', 'env', 'extension', 'models'] },
      }),
    ).toEqual(['models']);
  });
});

describe('findResolvedBindings', () => {
  it('finds lifecycle and controller resolutions', () => {
    expect(
      findResolvedBindings(
        "const worker = container.resolve('worker');\n" +
          "const { Post } = container.resolve('models');",
      ),
    ).toEqual(['worker', 'models']);
  });

  it('finds a resolution through the express app', () => {
    expect(
      findResolvedBindings(
        "const {\n  middlewares: { requirePermission },\n} = req.app.get('container').resolve('auth');",
      ),
    ).toEqual(['auth']);
  });

  it('finds a resolution through a lazily invoked container', () => {
    expect(
      findResolvedBindings("const models = container().resolve('models');"),
    ).toEqual(['models']);
  });

  it('does not mistake path.resolve or Promise.resolve for a binding', () => {
    expect(
      findResolvedBindings(
        "path.resolve(__dirname, 'assets');\nreturn Promise.resolve('x');",
      ),
    ).toEqual([]);
  });
});

describe('isCapabilityGranted', () => {
  it('honours the prefix and total wildcards', () => {
    expect(isCapabilityGranted(['users:*'], 'users:sessions')).toBe(true);
    expect(isCapabilityGranted(['*'], 'anything')).toBe(true);
    expect(isCapabilityGranted(['models'], 'db')).toBe(false);
  });
});

describe('auditExtensionCapabilities', () => {
  let workDir;

  beforeEach(async () => {
    workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'xnapify-cap-'));
  });

  afterEach(async () => {
    await fs.promises.rm(workDir, { recursive: true, force: true });
  });

  it('flags a binding the manifest never declared', async () => {
    await fs.promises.mkdir(path.join(workDir, 'api'), { recursive: true });
    await fs.promises.writeFile(
      path.join(workDir, 'api', 'index.js'),
      "export default { boot({ container }) { container.resolve('db'); } };",
    );

    const report = await auditExtensionCapabilities(workDir, {
      name: '@acme/demo',
      xnapify: { capabilities: ['models'] },
    });

    expect(report.undeclared).toEqual([
      { capability: 'db', files: [path.join('api', 'index.js')] },
    ]);
  });

  it('accepts a binding covered by the defaults', async () => {
    await fs.promises.writeFile(
      path.join(workDir, 'index.js'),
      "container.resolve('hook');",
    );

    const report = await auditExtensionCapabilities(workDir, {
      name: '@acme/demo',
    });

    expect(report.undeclared).toEqual([]);
  });

  it('ignores vendored dependencies', async () => {
    await fs.promises.mkdir(path.join(workDir, 'node_modules', 'dep'), {
      recursive: true,
    });
    await fs.promises.writeFile(
      path.join(workDir, 'node_modules', 'dep', 'index.js'),
      "container.resolve('jwt');",
    );

    const report = await auditExtensionCapabilities(workDir, {
      name: '@acme/demo',
      xnapify: { capabilities: [] },
    });

    expect(report.undeclared).toEqual([]);
  });
});

describe('bundled extensions', () => {
  const dirs = fs
    .readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name);

  it('finds the bundled extensions', () => {
    expect(dirs.length).toBeGreaterThan(0);
  });

  it.each(dirs)('%s declares every binding it resolves', async name => {
    const dir = path.join(EXTENSIONS_DIR, name);
    const manifest = JSON.parse(
      fs.readFileSync(path.join(dir, 'package.json'), 'utf8'),
    );
    const report = await auditExtensionCapabilities(dir, manifest);

    expect(report.undeclared).toEqual([]);
  });
});
