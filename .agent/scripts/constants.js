/**
 * Shared Constants — Single Source of Truth
 *
 * All agent scripts MUST import from this module rather than
 * defining their own SKIP_DIRS or EXTENSIONS sets.
 *
 * Categories:
 *   SKIP_DIRS        — directories excluded from every file-walk
 *   JS_EXTENSIONS    — JS/TS source files (logic, components)
 *   VIEW_EXTENSIONS  — JS/TS + HTML templates
 *   UI_EXTENSIONS    — full frontend audit (JS/TS + HTML + CSS + frameworks)
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ── Directories to skip during recursive file walks ─────────────────
const SKIP_DIRS = new Set([
  // Build / tooling artifacts
  'node_modules',
  '.cache',
  'build',
  'dist',
  'out',

  // Version control
  '.git',

  // Project-specific
  '.agent',
  '.xnapify',

  // Data-layer artifacts (auto-generated, not source code)
  'migrations',
  'seeds',

  // Test infrastructure
  '__mocks__',

  // Static assets (not auditable source)
  'translations',
  'benchmarks',
]);

// ── Files to skip during recursive file walks (exact match) ──────────
const SKIP_FILES = new Set([
  'package-lock.json',
  'eslint.factory.js',
  'babel.factory.js',
  'postcss.factory.js',
  'registry.factory.js',
  'jest.config.js',
]);

// ── File extension sets (by audit scope) ────────────────────────────

/** JS/TS source only — syntax checks, naming checks, import analysis */
const JS_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.cjs', '.mjs']);

/** JS/TS + HTML — accessibility and i18n audits */
const VIEW_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.html']);

/** Full frontend — UX audits including styles and framework templates */
const UI_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.html',
  '.vue',
  '.svelte',
  '.css',
  '.scss',
  '.less',
]);

// ── Shared file-walk utility ────────────────────────────────────────

/**
 * Recursively find files matching the given extension set.
 *
 * @param {string}     dir        — root directory to walk
 * @param {Set<string>} extensions — allowed file extensions (e.g. JS_EXTENSIONS)
 * @param {object}     [opts]     — options
 * @param {number}     [opts.limit=Infinity]   — max files to collect
 * @param {Set<string>} [opts.skipFiles]        — exact basenames to skip
 * @param {RegExp}     [opts.excludePattern]   — regex to exclude files (e.g. /\.test\.js$/)
 * @returns {string[]}
 */
function walkFiles(dir, extensions, opts = {}) {
  const { limit = Infinity, skipFiles = SKIP_FILES, excludePattern } = opts;
  const results = [];

  function walk(d) {
    if (results.length >= limit) return;
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= limit) return;
      const fullPath = path.join(d, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (!extensions.has(ext)) continue;
        if (skipFiles && skipFiles.has(entry.name)) continue;
        if (excludePattern && excludePattern.test(entry.name)) continue;
        results.push(fullPath);
      }
    }
  }

  walk(dir);
  return results;
}

module.exports = {
  SKIP_DIRS,
  SKIP_FILES,
  JS_EXTENSIONS,
  VIEW_EXTENSIONS,
  UI_EXTENSIONS,
  walkFiles,
};
