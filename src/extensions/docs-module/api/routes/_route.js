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
 */
export const middleware = false;

/**
 * Rate limit: allow 30 requests per minute per IP.
 * Recursive FS walk can be expensive on deeply nested trees.
 */
export const useRateLimit = { max: 30, windowMs: 60000 };

const CACHE_KEY = 'docs_tree';

// GET /api/docs
export const get = async (req, res) => {
  const container = req.app.get('container');
  const http = container.resolve('http');
  const cache = container.resolve('cache');

  // Obtain safe, scoped key isolation instance
  const scopedCache = cache.withNamespace('docs');

  // The assets directory is copied to the extension build root (where api.js lives)
  const publicDocsDir = path.resolve(__dirname, 'assets');

  try {
    // 1. Centralized Cache Evaluation
    const cachedTree = await scopedCache.get(CACHE_KEY);
    if (cachedTree) {
      return http.sendSuccess(res, cachedTree);
    }

    // 2. Dynamically Execute File Tree Search & Frontmatter Extraction
    const tree = await buildTree(publicDocsDir, publicDocsDir);

    // 3. Save into memory system (TTL: 60 seconds)
    await scopedCache.set(CACHE_KEY, tree, { ttl: 60 });

    return http.sendSuccess(res, tree);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return http.sendSuccess(res, []);
    }
    return http.sendServerError(res, 'Failed to read docs tree', err);
  }
};

/**
 * Safely parse Markdown Frontmatter extracting specific indexing keys.
 * Limits buffer read lengths for performant file scraping.
 */
async function extractFrontmatter(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const chunk = content.slice(0, 1000);

    let title = null;
    let sidebarPosition = 999;

    // Resolve explicitly YAML keys inside the --- boundary
    const titleMatch = chunk.match(/^title:\s*(.+)$/m);
    if (titleMatch) title = titleMatch[1].replace(/['"]/g, '').trim();

    const posMatch = chunk.match(/^sidebar_position:\s*(\d+)/m);
    if (posMatch) sidebarPosition = parseInt(posMatch[1], 10);

    return { title, sidebarPosition };
  } catch (e) {
    return { title: null, sidebarPosition: 999 };
  }
}

/**
 * Recursively builds a directory tree for the sidebar visually parsing components.
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
        // Directories visually bubble up their highest-priority item
        const lowestChildPos = children.reduce(
          (min, child) => Math.min(min, child.sidebarPosition || 999),
          999,
        );

        nodes.push({
          type: 'directory',
          name: entry.name,
          title:
            entry.name.charAt(0).toUpperCase() +
            entry.name.slice(1).replace(/-/g, ' '),
          path: relPath,
          sidebarPosition: lowestChildPos,
          children,
        });
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const cleanName = entry.name.replace(/\.md$/, '');
      const cleanPath = relPath.replace(/\.md$/, '');

      const { title, sidebarPosition } = await extractFrontmatter(fullPath);

      nodes.push({
        type: 'file',
        name: cleanName,
        title: title || cleanName,
        path: cleanPath,
        sidebarPosition,
      });
    }
  }

  // Exact Mathematical Sort: Primary Sort on Priority, Secondary by Alphabetical Directory
  nodes.sort((a, b) => {
    if (a.sidebarPosition !== b.sidebarPosition) {
      return a.sidebarPosition - b.sidebarPosition;
    }
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return nodes;
}
