/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const SCANNER = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  'secretScanner.js',
);

const repos = [];

afterAll(() => {
  repos.forEach(repo => fs.rmSync(repo, { recursive: true, force: true }));
});

/** Create a throwaway git repo with `files` staged, and return its path. */
function stagedRepo(files) {
  const repo = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'secret-scan-')),
  );
  repos.push(repo);

  execFileSync('git', ['init', '--quiet'], { cwd: repo });
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(repo, name), contents, 'utf8');
  }
  execFileSync('git', ['add', '-A'], { cwd: repo });

  return repo;
}

/** Run the scanner over a repo's tracked files. */
function scan(repo) {
  const result = spawnSync(process.execPath, [SCANNER, '--all'], {
    cwd: repo,
    encoding: 'utf-8',
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

/** A lockfile entry, given the `resolved` URL npm would have written. */
function lockfile(resolved) {
  return JSON.stringify(
    {
      name: 'fixture',
      lockfileVersion: 3,
      packages: {
        '': { name: 'fixture', dependencies: { widget: '^1.0.0' } },
        'node_modules/widget': {
          version: '1.0.0',
          resolved,
          integrity:
            'sha512-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQrStUvWxYz0123456789AbCdEfGhIjKlMnOpQr==',
        },
      },
    },
    null,
    2,
  );
}

describe('secret scanner', () => {
  // Regression: package-lock.json used to be skipped outright, which is
  // exactly where npm records the credentials of an authenticated private
  // registry.
  it('flags registry credentials embedded in a lockfile resolved URL', () => {
    const repo = stagedRepo({
      'package-lock.json': lockfile(
        'https://ci-bot:hunter2isnotmypassword@npm.internal.example/widget/-/widget-1.0.0.tgz',
      ),
    });

    const { status, output } = scan(repo);

    expect(status).toBe(1);
    expect(output).toContain('package-lock.json');
    expect(output).toContain('Credentials Embedded in URL');
  });

  it('passes a lockfile that resolves from the public registry', () => {
    const repo = stagedRepo({
      'package-lock.json': lockfile(
        'https://registry.npmjs.org/widget/-/widget-1.0.0.tgz',
      ),
    });

    expect(scan(repo).status).toBe(0);
  });

  it('does not trip over integrity digests or host:port URLs', () => {
    const repo = stagedRepo({
      'package-lock.json': lockfile(
        'https://registry.npmjs.org/widget/-/widget-1.0.0.tgz',
      ),
      'app.js': [
        "const base = 'http://localhost:1337/api';",
        "const cdn = 'https://cdn.jsdelivr.net/npm/widget@1.0.0/dist/widget.js';",
        'module.exports = { base, cdn };',
      ].join('\n'),
    });

    expect(scan(repo).status).toBe(0);
  });

  it('still flags credentials in a URL outside a lockfile', () => {
    const repo = stagedRepo({
      'client.js':
        "fetch('https://svc-account:s3cr3t-token-value@api.example.com/v1/ping');",
    });

    const { status, output } = scan(repo);

    expect(status).toBe(1);
    expect(output).toContain('Credentials Embedded in URL');
  });
});
