/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import http from 'http';
import os from 'os';
import path from 'path';
import zlib from 'zlib';

import express from 'express';

import { createPrecompressedStatic } from './precompressed.js';

const ORIGINAL = 'console.log("hello from the uncompressed original");';

/**
 * Names that survive `encodeURI` unescaped ("#", "?") or that a naive
 * re-encode mangles (spaces, non-ASCII). Each one must come back as its own
 * precompressed variant, not as a prefix of itself.
 */
const AWKWARD_NAMES = Object.freeze([
  'a#b.js',
  'q?x.js',
  'with space.js',
  'h\u00e9llo-\u65e5\u672c.js',
]);

const bodyFor = name => `console.log(${JSON.stringify(name)});`;

function request(server, urlPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    http
      .get({ host: '127.0.0.1', port, path: urlPath, headers }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      })
      .on('error', reject);
  });
}

describe('createPrecompressedStatic', () => {
  let root;
  let server;

  beforeAll(async () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'xnapify-precompressed-'));
    fs.mkdirSync(path.join(root, 'assets'));
    fs.writeFileSync(path.join(root, 'assets', 'app.js'), ORIGINAL);
    fs.writeFileSync(
      path.join(root, 'assets', 'app.js.br'),
      zlib.brotliCompressSync(Buffer.from(ORIGINAL)),
    );
    fs.writeFileSync(
      path.join(root, 'assets', 'app.js.gz'),
      zlib.gzipSync(Buffer.from(ORIGINAL)),
    );
    fs.writeFileSync(path.join(root, 'plain.css'), 'body{color:red}');

    // Distinct file at the DOC ROOT sharing app.js's basename, so a request
    // that gets resolved against the wrong directory is unambiguous.
    const rootMarker = 'console.log("ROOT_MARKER");';
    fs.writeFileSync(path.join(root, 'app.js'), rootMarker);
    fs.writeFileSync(
      path.join(root, 'app.js.br'),
      zlib.brotliCompressSync(Buffer.from(rootMarker)),
    );

    for (const name of AWKWARD_NAMES) {
      const body = bodyFor(name);
      fs.writeFileSync(path.join(root, 'assets', name), body);
      fs.writeFileSync(
        path.join(root, 'assets', `${name}.br`),
        zlib.brotliCompressSync(Buffer.from(body)),
      );
    }

    const app = express();
    app.use(createPrecompressedStatic(root, { statCacheTtl: 0 }));
    app.use((req, res) => res.status(404).send('miss'));
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('serves the brotli variant with the original media type', async () => {
    const res = await request(server, '/assets/app.js', {
      'accept-encoding': 'gzip, deflate, br',
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBe('br');
    expect(res.headers['content-type']).toMatch(/javascript/);
    expect(res.headers.vary).toMatch(/Accept-Encoding/i);
    expect(zlib.brotliDecompressSync(res.body).toString()).toBe(ORIGINAL);
  });

  test('falls back to gzip when brotli is not accepted', async () => {
    const res = await request(server, '/assets/app.js', {
      'accept-encoding': 'gzip',
    });
    expect(res.headers['content-encoding']).toBe('gzip');
    expect(zlib.gunzipSync(res.body).toString()).toBe(ORIGINAL);
  });

  test('respects q=0 and serves the original', async () => {
    const res = await request(server, '/assets/app.js', {
      'accept-encoding': 'br;q=0, gzip;q=0',
    });
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.body.toString()).toBe(ORIGINAL);
  });

  test('serves files without a precompressed sibling untouched', async () => {
    const res = await request(server, '/plain.css', {
      'accept-encoding': 'br',
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
    expect(res.body.toString()).toBe('body{color:red}');
  });

  test.each(AWKWARD_NAMES)(
    'serves the precompressed variant of %s, not a truncated neighbour',
    async name => {
      const res = await request(server, `/assets/${encodeURIComponent(name)}`, {
        'accept-encoding': 'br',
      });
      expect(res.status).toBe(200);
      expect(res.headers['content-encoding']).toBe('br');
      expect(res.headers['content-type']).toMatch(/javascript/);
      expect(zlib.brotliDecompressSync(res.body).toString()).toBe(
        bodyFor(name),
      );
    },
  );

  test('never escapes the root directory', async () => {
    const res = await request(server, '/../package.json', {
      'accept-encoding': 'br',
    });
    expect(res.status).toBe(404);
  });

  test('never escapes the root directory via percent-encoded dots', async () => {
    const res = await request(
      server,
      '/assets/%2e%2e%2f%2e%2e%2fpackage.json',
      {
        'accept-encoding': 'br',
      },
    );
    expect(res.status).not.toBe(200);
    expect(res.headers['content-encoding']).toBeUndefined();
  });

  test('a doubled leading slash cannot absorb into the URL authority and serve a different file', async () => {
    // Regression: `new URL('//assets/app.js', 'http://localhost').pathname`
    // is `/app.js` — WHATWG URL treats the doubled slash as a network-path
    // reference and consumes "assets" as the authority — while express's own
    // parseurl-based router sees the literal pathname `//assets/app.js` and,
    // after path.join collapses the repeated slash, resolves it to
    // `<root>/assets/app.js`. Left unguarded, this handler stats and serves
    // the ROOT's `app.js.br` for a request every other part of the stack
    // resolves to `assets/app.js` — the same URL answering two different
    // bodies depending on `Accept-Encoding`, with `Vary` telling a shared
    // cache they are interchangeable.
    const res = await request(server, '//assets/app.js', {
      'accept-encoding': 'br',
    });
    const body =
      res.headers['content-encoding'] === 'br'
        ? zlib.brotliDecompressSync(res.body).toString()
        : res.body.toString();
    expect(body).not.toContain('ROOT_MARKER');
    if (res.status === 200) {
      expect(body).toBe(ORIGINAL);
    }
  });

  test('passes through unknown files', async () => {
    const res = await request(server, '/nope.js', { 'accept-encoding': 'br' });
    expect(res.status).toBe(404);
    expect(res.body.toString()).toBe('miss');
  });
});
