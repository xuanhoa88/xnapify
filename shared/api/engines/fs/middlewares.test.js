/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { createWriteStream } from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { createUploadMiddleware, MIDDLEWARES } from './middlewares.js';
import { LocalFilesystemProvider } from './providers/local.js';

const BOUNDARY = 'xnapifytestboundary';

const partHeader = Buffer.from(
  `--${BOUNDARY}\r\n` +
    'Content-Disposition: form-data; name="file"; filename="upload.txt"\r\n' +
    'Content-Type: text/plain\r\n\r\n',
);
const partFooter = Buffer.from(`\r\n--${BOUNDARY}--\r\n`);

/**
 * A request that behaves like an incoming multipart POST: multer parses a body
 * only when type-is sees both a multipart content type and a length or
 * transfer-encoding header, and it treats a client that goes away as a stream
 * error on the request.
 */
function createRequest() {
  const req = new Readable({ read() {} });
  req.headers = {
    'content-type': `multipart/form-data; boundary=${BOUNDARY}`,
    'transfer-encoding': 'chunked',
  };
  return req;
}

function runMiddleware(middleware, req) {
  return new Promise(resolve => middleware(req, {}, resolve));
}

async function waitFor(condition, label) {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

let basePath;
let deleted;
let real;

beforeEach(async () => {
  basePath = await fsp.mkdtemp(path.join(os.tmpdir(), 'xnapify-upload-'));
  deleted = [];
  real = new LocalFilesystemProvider({ basePath });
  await real.ready;
});

afterEach(async () => {
  await fsp.rm(basePath, { recursive: true, force: true });
});

/**
 * Wrap a `store` in the delete/exists of a real local provider, recording the
 * names it is asked to remove. The engine has to clean up after any provider,
 * so the cases below drive it with the failures a provider can hand it rather
 * than with whatever recovery one particular provider happens to do today.
 */
function providerWith(store) {
  return {
    store,
    delete(fileName) {
      deleted.push(fileName);
      return real.delete(fileName);
    },
    exists(fileName) {
      return real.exists(fileName);
    },
  };
}

describe('upload middleware cleanup', () => {
  it('keeps a file that uploaded successfully', async () => {
    const middleware = createUploadMiddleware(real, { fieldName: 'file' });

    const req = createRequest();
    const done = runMiddleware(middleware, req);
    req.push(partHeader);
    req.push(Buffer.alloc(512, 0x61));
    req.push(partFooter);
    req.push(null);
    await done;

    const result = req[MIDDLEWARES.UPLOAD];
    expect(result.success).toBe(true);
    expect(result.data.size).toBe(512);
    expect(await fsp.readdir(basePath)).toEqual([result.data.fileName]);
  });

  it('removes the partial file when the client aborts mid-upload', async () => {
    // A provider that streams straight to its destination, so the bytes an
    // abandoned upload wrote are sitting under the destination name.
    const provider = providerWith(async (fileName, stream) => {
      const filePath = path.join(basePath, fileName);
      await pipeline(stream, createWriteStream(filePath));
      return { fileName, filePath };
    });
    const middleware = createUploadMiddleware(provider, { fieldName: 'file' });

    const req = createRequest();
    const done = runMiddleware(middleware, req);
    req.push(partHeader);
    req.push(Buffer.alloc(4 * 1024 * 1024, 0x61));

    // Pull the socket only once bytes are really on disk, so this is about the
    // cleanup and not about the write never having started.
    await waitFor(
      async () => (await fsp.readdir(basePath)).length > 0,
      'the upload to reach the disk',
    );
    req.destroy(new Error('aborted'));
    await done;

    expect(req[MIDDLEWARES.UPLOAD].success).toBe(false);
    expect(await fsp.readdir(basePath)).toEqual([]);
  });

  it('removes an upload that lands after the client has gone', async () => {
    // The abort sweep runs while the store is still in flight, so a removal
    // that does not wait for it deletes a name nothing has created yet and the
    // bytes arrive unowned a moment later.
    let landed;
    const stored = new Promise(resolve => {
      landed = resolve;
    });
    const provider = providerWith(async (fileName, stream) => {
      stream.on('error', () => {});
      await new Promise(resolve => setTimeout(resolve, 50));
      const filePath = path.join(basePath, fileName);
      await fsp.writeFile(filePath, 'landed late');
      landed();
      return { fileName, filePath, size: 11 };
    });
    const middleware = createUploadMiddleware(provider, { fieldName: 'file' });

    const req = createRequest();
    const done = runMiddleware(middleware, req);
    req.push(partHeader);
    req.push(Buffer.alloc(1024, 0x61));
    req.destroy(new Error('aborted'));
    await done;

    // The request is answered before the store settles, so wait for the bytes
    // to exist before asking whether anything ever removes them.
    await stored;
    await waitFor(
      async () => (await fsp.readdir(basePath)).length === 0,
      'the late upload to be removed',
    );
  });

  it('removes the partial file when the provider fails mid-write', async () => {
    // A disk that fills up part-way through: the bytes already written stay
    // where the provider put them.
    const provider = providerWith(async (fileName, stream) => {
      const chunk = await new Promise(resolve => stream.once('data', resolve));
      await fsp.writeFile(path.join(basePath, fileName), chunk);
      const error = new Error('ENOSPC: no space left on device');
      error.code = 'ENOSPC';
      throw error;
    });
    const middleware = createUploadMiddleware(provider, { fieldName: 'file' });

    const req = createRequest();
    const done = runMiddleware(middleware, req);
    req.push(partHeader);
    req.push(Buffer.alloc(256 * 1024, 0x61));
    req.push(partFooter);
    req.push(null);
    await done;

    expect(req[MIDDLEWARES.UPLOAD]).toEqual({
      success: false,
      error: 'ENOSPC: no space left on device',
    });
    expect(await fsp.readdir(basePath)).toEqual([]);
  });

  it('names the file it asks the provider to delete when a store is rejected over the size limit', async () => {
    const provider = providerWith(async (fileName, stream) => {
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      await fsp.writeFile(path.join(basePath, fileName), Buffer.concat(chunks));
      throw new Error('File size exceeds limit');
    });
    const middleware = createUploadMiddleware(provider, {
      fieldName: 'file',
      maxFileSize: 1024,
    });

    const req = createRequest();
    const done = runMiddleware(middleware, req);
    req.push(partHeader);
    req.push(Buffer.alloc(4096, 0x61));
    req.push(partFooter);
    req.push(null);
    await done;

    // multer merges a store's result into the file object only when the store
    // succeeded, so a removal keyed off that result asks the provider to
    // delete `undefined` and reports a path error instead of freeing anything.
    expect(deleted.length).toBeGreaterThan(0);
    expect(deleted.filter(fileName => typeof fileName !== 'string')).toEqual(
      [],
    );
    expect(await fsp.readdir(basePath)).toEqual([]);
  });
});

describe('upload middleware options', () => {
  function partHeaderFor(filename) {
    return Buffer.from(
      `--${BOUNDARY}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        'Content-Type: text/plain\r\n\r\n',
    );
  }

  it('honours maxSize as an alias for maxFileSize', async () => {
    // Every route in this codebase passes `maxSize`, the option this bug made
    // multer never see — the middleware always built with its 10MB default
    // instead. multer's own 'File too large' message (as opposed to any
    // message a provider might throw) proves the limit fired inside multer
    // itself, so `maxSize` really reached `limits.fileSize`.
    const provider = providerWith(async (fileName, stream) => {
      for await (const chunk of stream) void chunk;
      return { fileName, size: 4096 };
    });
    const middleware = createUploadMiddleware(provider, {
      fieldName: 'file',
      maxSize: 1024,
    });

    const req = createRequest();
    const done = runMiddleware(middleware, req);
    req.push(partHeader);
    req.push(Buffer.alloc(4096, 0x61));
    req.push(partFooter);
    req.push(null);
    await done;

    expect(req[MIDDLEWARES.UPLOAD]).toEqual({
      success: false,
      error: 'File too large',
    });
  });

  it('still applies the 10MB default when neither maxSize nor maxFileSize is given', async () => {
    const middleware = createUploadMiddleware(real, { fieldName: 'file' });

    const req = createRequest();
    const done = runMiddleware(middleware, req);
    req.push(partHeader);
    req.push(Buffer.alloc(512, 0x61));
    req.push(partFooter);
    req.push(null);
    await done;

    expect(req[MIDDLEWARES.UPLOAD].success).toBe(true);
  });

  it('clamps an attacker-supplied extension so the write path cannot overflow NAME_MAX', async () => {
    const middleware = createUploadMiddleware(real, { fieldName: 'file' });
    const longExtension = `.${'j'.repeat(300)}`;

    const req = createRequest();
    const done = runMiddleware(middleware, req);
    req.push(partHeaderFor(`payload${longExtension}`));
    req.push(Buffer.alloc(64, 0x61));
    req.push(partFooter);
    req.push(null);
    await done;

    const result = req[MIDDLEWARES.UPLOAD];
    expect(result.success).toBe(true);
    expect(result.data.fileName.length).toBeLessThan(64);
    expect(await fsp.readdir(basePath)).toEqual([result.data.fileName]);
  });
});
