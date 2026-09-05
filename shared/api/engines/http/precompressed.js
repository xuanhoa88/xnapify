/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs';
import path from 'path';

import express from 'express';

/** Preferred first. Brotli is smaller and every evergreen browser sends it. */
const ENCODINGS = Object.freeze([
  { encoding: 'br', ext: '.br' },
  { encoding: 'gzip', ext: '.gz' },
]);

/**
 * Whether an `Accept-Encoding` header admits an encoding (q > 0).
 *
 * @param {string} header
 * @param {string} encoding
 * @returns {boolean}
 */
function acceptsEncoding(header, encoding) {
  for (const part of header.split(',')) {
    const [token, ...params] = part.trim().split(';');
    if (token.trim().toLowerCase() !== encoding) continue;
    const q = params
      .map(p => p.trim().toLowerCase())
      .find(p => p.startsWith('q='));
    if (!q) return true;
    return parseFloat(q.slice(2)) > 0;
  }
  return false;
}

/**
 * Serve build-time precompressed variants (`file.br`, `file.gz`) of static
 * files, falling back to `express.static` for everything else.
 *
 * The original file's media type is kept; only the transfer encoding changes.
 * Existence checks are cached (production) so the hot path is one map lookup.
 *
 * @param {string} root - Absolute directory to serve
 * @param {Object} [options] - `express.static` options plus:
 * @param {number} [options.statCacheTtl] - Existence cache TTL in ms (0 disables)
 * @returns {import('express').RequestHandler}
 */
export function createPrecompressedStatic(root, options = {}) {
  const { statCacheTtl = __DEV__ ? 0 : 60_000, ...staticOptions } = options;
  const absoluteRoot = path.resolve(root);
  const serve = express.static(absoluteRoot, staticOptions);
  const statCache = new Map();

  function fileExists(file) {
    if (statCacheTtl > 0) {
      const cached = statCache.get(file);
      if (cached && cached.expires > Date.now()) return cached.exists;
    }
    let exists = false;
    try {
      exists = fs.statSync(file).isFile();
    } catch {
      exists = false;
    }
    if (statCacheTtl > 0) {
      if (statCache.size > 10_000) statCache.clear();
      statCache.set(file, { exists, expires: Date.now() + statCacheTtl });
    }
    return exists;
  }

  return function precompressedStatic(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return serve(req, res, next);
    }

    const accept = req.headers['accept-encoding'];
    if (typeof accept !== 'string' || accept.length === 0) {
      return serve(req, res, next);
    }

    let pathname;
    let search = '';
    try {
      const url = new URL(req.url, 'http://localhost');
      pathname = decodeURIComponent(url.pathname);
      search = url.search;
    } catch {
      return serve(req, res, next);
    }

    if (pathname.includes('\0') || pathname.endsWith('/')) {
      return serve(req, res, next);
    }

    const absolute = path.normalize(path.join(absoluteRoot, pathname));
    if (!absolute.startsWith(absoluteRoot + path.sep)) {
      return serve(req, res, next);
    }

    for (const { encoding, ext } of ENCODINGS) {
      if (!acceptsEncoding(accept, encoding)) continue;
      if (!fileExists(absolute + ext)) continue;

      const type = express.static.mime.lookup(absolute);
      const charset = express.static.mime.charsets.lookup(type);
      res.setHeader(
        'Content-Type',
        charset ? `${type}; charset=${charset}` : type,
      );
      res.setHeader('Content-Encoding', encoding);
      res.vary('Accept-Encoding');

      const originalUrl = req.url;
      req.url = encodeURI(pathname + ext) + search;
      return serve(req, res, err => {
        // Variant vanished between the existence check and the send:
        // restore the request and let the uncompressed path handle it.
        req.url = originalUrl;
        res.removeHeader('Content-Encoding');
        res.removeHeader('Content-Type');
        if (err) return next(err);
        return serve(req, res, next);
      });
    }

    return serve(req, res, next);
  };
}

export default createPrecompressedStatic;
