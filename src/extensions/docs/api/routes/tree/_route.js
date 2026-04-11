/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Public documentation tree — read-only static file listing.
 * No authentication required since docs are publicly served from public/docs.
 */
export const middleware = false;

/**
 * Rate limit: allow 30 requests per minute per IP.
 * Recursive FS walk can be expensive on deeply nested trees.
 */
export const useRateLimit = { max: 30, windowMs: 60000 };

// In-memory cache to avoid repeated filesystem walks
let cachedTree = null;
let cacheExpiry = 0;
const CACHE_TTL = 60000; // 1 minute

// GET /api/docs/tree
export const get = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const publicDocsDir = path.resolve(process.cwd(), 'public', 'docs');

  try {
    const now = Date.now();
    if (cachedTree && now < cacheExpiry) {
      return http.sendSuccess(res, { tree: cachedTree });
    }

    const tree = await buildTree(publicDocsDir, publicDocsDir);
    cachedTree = tree;
    cacheExpiry = now + CACHE_TTL;
    return http.sendSuccess(res, { tree });
  } catch (err) {
    // If the directory simply does not exist, return empty tree
    if (err.code === 'ENOENT') {
      return http.sendSuccess(res, { tree: [] });
    }
    return http.sendServerError(res, 'Failed to read docs tree', err);
  }
};

/**
 * Recursively builds a directory tree for the sidebar.
 * @param {string} currentDir - Absolute path to current traversal directory
 * @param {string} baseDir - Absolute path to the root docs directory (for traversal guard)
 * @returns {Promise<Array>}
 */
async function buildTree(currentDir, baseDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const nodes = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // ignore hidden like .DS_Store

    const fullPath = path.join(currentDir, entry.name);

    // Path traversal guard: resolve symlinks and ensure we stay inside baseDir
    let realPath;
    try {
      realPath = await fs.realpath(fullPath);
    } catch (_e) {
      continue; // broken symlink — skip
    }
    const realBase = await fs.realpath(baseDir);
    if (!realPath.startsWith(realBase)) continue; // escape attempt — skip

    const relPath = path.relative(baseDir, realPath);

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, baseDir);
      if (children.length > 0) {
        nodes.push({
          type: 'directory',
          name: entry.name,
          path: relPath,
          children,
        });
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const cleanName = entry.name.replace(/\.md$/, '');
      const cleanPath = relPath.replace(/\.md$/, '');
      nodes.push({
        type: 'file',
        name: cleanName,
        path: cleanPath,
      });
    }
  }

  // Basic alphabetical sort: directories first, then files
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}
