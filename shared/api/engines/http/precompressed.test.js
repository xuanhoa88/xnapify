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

  test('never escapes the root directory', async () => {
    const res = await request(server, '/../package.json', {
      'accept-encoding': 'br',
    });
    expect(res.status).toBe(404);
  });

  test('passes through unknown files', async () => {
    const res = await request(server, '/nope.js', { 'accept-encoding': 'br' });
    expect(res.status).toBe(404);
    expect(res.body.toString()).toBe('miss');
  });
});
