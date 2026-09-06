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
      // A request path starting with "//" (or more) is parsed by WHATWG URL
      // as a network-path reference: the segment after the slashes becomes
      // the AUTHORITY, not part of the pathname — `new URL('//assets/app.js',
      // 'http://localhost').pathname` is `/app.js`, host `assets`. Express's
      // actual router resolves the path with `parseurl` (legacy `url.parse`),
      // which has no such rule and sees the literal pathname `//assets/app.js`.
      // Left unchecked, this handler would stat and serve the compressed
      // variant of a DIFFERENT file than the one express.static ends up
      // matching for the same request — with `Vary: Accept-Encoding` already
      // set, telling any shared cache the two bodies are interchangeable.
      if (url.host !== 'localhost') {
        return serve(req, res, next);
      }
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

      // Express 4 coupling: `express.static.mime` is the mime@1 instance and is
      // gone in Express 5 (it moved to mime-types inside send). An upgrade has
      // to replace these two calls, not just bump the dependency.
      const type = express.static.mime.lookup(absolute);
      const charset = express.static.mime.charsets.lookup(type);
      res.setHeader(
        'Content-Type',
        charset ? `${type}; charset=${charset}` : type,
      );
      res.setHeader('Content-Encoding', encoding);
      res.vary('Accept-Encoding');

      const originalUrl = req.url;
      // Re-encode segment by segment. encodeURI leaves "#" and "?" unescaped,
      // so an asset named "a#b.js" was re-issued as "/a#b.js.br" and re-parsed
      // by express.static as the pathname "/a" — it served a different file
      // than the one fileExists() just approved. encodeURIComponent escapes
      // both; splitting on "/" first preserves the separators it would
      // otherwise escape, so the round-trip lands back on `absolute + ext`.
      req.url =
        (pathname + ext)
          .split('/')
          .map(segment => encodeURIComponent(segment))
          .join('/') + search;
      return serve(req, res, err => {
        // Variant vanished between the existence check and the send:
        // restore the request and let the uncompressed path handle it.
        req.url = originalUrl;
        if (err) {
          // `err` only reaches this callback once serve-static's `forwardError`
          // flag has flipped — which happens on send's `file` event, i.e. after
          // headers may already be flushed. Forward before touching them: a
          // `removeHeader` call here can throw ERR_HTTP_HEADERS_SENT, which
          // would replace the real error with a bookkeeping one and, if it
          // fires inside an fs stream's own `error` emit, crash the process.
          return next(err);
        }
        res.removeHeader('Content-Encoding');
        res.removeHeader('Content-Type');
        return serve(req, res, next);
      });
    }

    return serve(req, res, next);
  };
}

export default createPrecompressedStatic;
