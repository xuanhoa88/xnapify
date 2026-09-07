/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

// The compiler and the config factory behind it are ESM-only and pull in the
// whole bundler; none of that participates in how the build callback settles
// the promise this task returns, so each is replaced by the smallest stand-in
// that still lets discovery and the post-compilation steps run.
jest.mock('@rspack/core', () => {
  let compiler = null;
  return {
    rspack: () => compiler,
    __setCompiler: next => {
      compiler = next;
    },
  };
});
jest.mock('../rspack/extension.config.js', () => ({
  createExtensionConfig: () => ({}),
  getHmrWatchIgnored: () => [],
}));
jest.mock('../utils/extension.js', () => ({
  auditExtensionCapabilities: async () => ({ undeclared: [], granted: [] }),
  computeChecksum: async () => 'sha256-stub',
  generateExtensionId: name => `id:${name}`,
}));
jest.mock('../utils/fs.js', () => ({
  copyDir: jest.fn(),
  pathExists: jest.fn(),
}));
jest.mock('../utils/logger.js', () => ({
  logInfo: () => {},
  logError: () => {},
  formatDuration: ms => `${ms}ms`,
}));

import fs from 'fs';
import os from 'os';
import path from 'path';

import { __setCompiler } from '@rspack/core';

import { copyDir, pathExists } from '../utils/fs.js';

/** A compilation rspack reports as clean. */
const cleanStats = {
  hasErrors: () => false,
  hasWarnings: () => false,
  toJson: () => ({ errors: [], warnings: [] }),
};

/**
 * Rspack calls the build callback for effect only, so a callback that never
 * settles the build promise stalls instead of failing. Racing a deadline turns
 * that stall into an assertable outcome rather than a whole-suite timeout.
 */
function settlesWithin(promise, ms) {
  let timer;
  const deadline = new Promise((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error('build promise never settled')),
      ms,
    );
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

let buildExtensions;
let workspace;
const originalEnv = {};

beforeAll(async () => {
  workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'xnapify-extension-'));

  const extensionDir = path.join(workspace, 'src', 'extensions', 'demo-ext');
  fs.mkdirSync(extensionDir, { recursive: true });
  fs.writeFileSync(
    path.join(extensionDir, 'package.json'),
    JSON.stringify({ name: 'demo-ext', version: '1.0.0', main: 'api.js' }),
  );
  fs.writeFileSync(path.join(extensionDir, 'api.js'), 'export default {};\n');

  // Both directories are resolved once, when the task module is evaluated.
  originalEnv.APP_DIR = process.env.APP_DIR;
  originalEnv.BUILD_DIR = process.env.BUILD_DIR;
  originalEnv.NODE_ENV = process.env.NODE_ENV;
  process.env.APP_DIR = path.join(workspace, 'src');
  process.env.BUILD_DIR = path.join(workspace, 'build');

  ({ default: buildExtensions } = await import('./extension.js'));
});

afterAll(() => {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(workspace, { recursive: true, force: true });
});

beforeEach(() => {
  pathExists.mockResolvedValue(true);
  copyDir.mockResolvedValue(undefined);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  process.env.NODE_ENV = originalEnv.NODE_ENV;
  jest.restoreAllMocks();
});

describe('buildExtensions', () => {
  it('closes the compiler and resolves once a clean build is post-processed', async () => {
    let closeCalls = 0;
    __setCompiler({
      run: onBuild => onBuild(null, cleanStats),
      close: done => {
        closeCalls += 1;
        done(null);
      },
    });

    await expect(
      settlesWithin(buildExtensions(), 5000),
    ).resolves.toBeUndefined();
    expect(closeCalls).toBe(1);
  });

  // Regression: the post-compilation steps run inside the callback rspack
  // invokes, and rspack discards whatever that callback returns. A rejection
  // there reached nobody — the build promise stayed pending forever and node
  // aborted the process on the unhandled rejection instead.
  it('rejects with the filesystem error when a post-compilation step fails', async () => {
    copyDir.mockRejectedValue(
      Object.assign(new Error('EACCES: permission denied, copyfile'), {
        code: 'EACCES',
      }),
    );
    __setCompiler({
      run: onBuild => onBuild(null, cleanStats),
      close: done => done(null),
    });

    await expect(settlesWithin(buildExtensions(), 5000)).rejects.toThrow(
      'EACCES: permission denied, copyfile',
    );
  });

  it('closes the compiler on the failure path too', async () => {
    // build.js retries this whole call, so a compiler left open on failure
    // means a second one is constructed while the first still holds its file
    // handles and worker threads.
    let closeCalls = 0;
    copyDir.mockRejectedValue(
      Object.assign(new Error('EACCES: permission denied, copyfile'), {
        code: 'EACCES',
      }),
    );
    __setCompiler({
      run: onBuild => onBuild(null, cleanStats),
      close: done => {
        closeCalls += 1;
        done(null);
      },
    });

    await expect(settlesWithin(buildExtensions(), 5000)).rejects.toThrow(
      'EACCES',
    );
    expect(closeCalls).toBe(1);
  });

  // Watch mode already survives a compilation error, so a transient fs error
  // must not be fatal either: the dev server stays attached to this watcher,
  // and it is still waiting on the first build to report.
  it('settles the first watch build when a post-compilation step fails', async () => {
    process.env.NODE_ENV = 'development';
    copyDir.mockRejectedValue(
      Object.assign(new Error('EEXIST: file already exists, symlink'), {
        code: 'EEXIST',
      }),
    );
    let watching = true;
    __setCompiler({
      watch: (_options, onBuild) => {
        onBuild(null, cleanStats);
        return {
          close: () => {
            watching = false;
          },
        };
      },
      close: done => done(null),
    });

    await expect(
      settlesWithin(buildExtensions({ watch: true }), 5000),
    ).resolves.toBeUndefined();
    expect(watching).toBe(true);
  });
});
