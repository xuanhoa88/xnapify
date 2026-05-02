#!/usr/bin/env node

/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * Setup — Install all project dependencies (root + sub-packages).
 * Pure Node.js, no external dependencies required.
 *
 * Usage:
 *   node tools/npm/setup.js
 *   npm run setup
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Paths ───────────────────────────────────────────────────────────────────

const ROOT = process.cwd();

/**
 * Parse .gitignore to build a set of directory names to skip.
 */
function loadSkipDirs() {
  const always = ['.git'];

  try {
    const content = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    const dirs = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#') && !line.startsWith('!'))
      .filter(line => line.endsWith('/') || !line.includes('.'))
      .map(line => line.replace(/^\/|\/$/g, ''))
      .filter(name => name && !name.includes('/') && !name.includes('*'));

    return new Set([...always, ...dirs]);
  } catch {
    return new Set([...always, 'node_modules', 'build', 'dist', 'coverage']);
  }
}

const SKIP_DIRS = loadSkipDirs();

// ─── Logging ─────────────────────────────────────────────────────────────────

const log = msg => console.log(msg);
const warn = msg => console.warn(`⚠️  ${msg}`);

function elapsed(start) {
  const ms = Date.now() - start;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

// ─── Version check ───────────────────────────────────────────────────────────

function checkVersions() {
  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'),
    );
    const engines = pkg.engines || {};
    const nodeReq = (engines.node || '').replace(/[>=^~]/g, '');
    const npmReq = (engines.npm || '').replace(/[>=^~]/g, '');
    const nodeCur = process.versions.node;

    // Parse npm version from npm_config_user_agent (nvm-safe, no subprocess)
    // Format: "npm/8.5.0 node/v16.14.2 darwin arm64"
    const ua = process.env.npm_config_user_agent || '';
    const npmMatch = ua.match(/npm\/(\S+)/);
    const npmCur = npmMatch ? npmMatch[1] : 'unknown';

    const nodeMajor = parseInt(nodeCur.split('.')[0], 10);
    const nodeReqMajor = parseInt(nodeReq.split('.')[0], 10);
    const npmMajor = parseInt(npmCur.split('.')[0], 10);
    const npmReqMajor = parseInt(npmReq.split('.')[0], 10);

    if (nodeMajor < nodeReqMajor || npmMajor < npmReqMajor) {
      warn(
        `Expected node>=${nodeReq} npm>=${npmReq}, got node=${nodeCur} npm=${npmCur}`,
      );
      log('   💡 Try: nvm install && nvm use');
    }
  } catch {
    // Non-fatal — continue with install
  }
}

// ─── npm install wrapper ─────────────────────────────────────────────────────

function npmInstall(cwd, label) {
  const start = Date.now();

  try {
    execSync('npm install --xnapify-setup --no-fund --no-audit', {
      cwd,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        CI: 'true',
        npm_config_engine_strict: 'false',
      },
    });
    log(`   ✅ ${label} (${elapsed(start)})`);
    return true;
  } catch (error) {
    warn(`${label} failed: ${error.message}`);
    return false;
  }
}

// ─── Find all package.json in the project ────────────────────────────────────

function findSubPackages(dir) {
  const results = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || SKIP_DIRS.has(entry.name)) continue;

    const child = path.join(dir, entry.name);
    const pkgPath = path.join(child, 'package.json');

    if (fs.existsSync(pkgPath)) {
      // Skip packages with no installable dependencies
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const hasDeps =
          Object.keys(pkg.dependencies || {}).length > 0 ||
          Object.keys(pkg.devDependencies || {}).length > 0;

        if (hasDeps) {
          results.push({
            name: path.relative(ROOT, child),
            dir: child,
          });
        }
      } catch {
        // Malformed package.json — skip
      }
    }

    // Recurse deeper
    results.push(...findSubPackages(child));
  }

  return results;
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  const start = Date.now();
  const skipRoot = process.argv.includes('--skip-root');

  checkVersions();
  log('📦 Installing all dependencies...');

  // 1. Root
  if (skipRoot) {
    log('   [1/2] Root (skipped)');
  } else {
    log('   [1/2] Root');
    if (!npmInstall(ROOT, 'root')) {
      log('❌ Root install failed');
      process.exit(1);
    }
  }

  // 2. Sub-packages
  log('   [2/2] Sub-packages');
  const packages = findSubPackages(ROOT);

  if (packages.length === 0) {
    log('   (none found)');
  } else {
    const failed = [];
    for (const pkg of packages) {
      if (!npmInstall(pkg.dir, pkg.name)) {
        failed.push(pkg.name);
      }
    }

    if (failed.length > 0) {
      log(`❌ Failed: ${failed.join(', ')}`);
      process.exit(1);
    }
  }

  log(`✅ All dependencies installed (${elapsed(start)})`);
}

main();
