#!/usr/bin/env node

/**
 * RBAC Coverage Check
 *
 * Finds _route.js files missing requirePermission middleware
 * or missing the middleware export entirely.
 *
 * Usage: node .agent/skills/security-auditor/scripts/rbacCoverageCheck.js [appsDir]
 * Default: src/apps/
 */

const fs = require('fs');
const path = require('path');

const APPS_DIR = process.argv[2] || path.join(process.cwd(), 'src/apps');

function findRouteFiles(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        results.push(...findRouteFiles(full));
      } else if (entry.isFile() && entry.name === '_route.js') {
        results.push(full);
      }
    }
  } catch {
    // Skip unreadable
  }
  return results;
}

console.log('═══════════════════════════════════════════════════');
console.log('  RBAC Coverage Check');
console.log('═══════════════════════════════════════════════════\n');

let unprotected = 0;
let intentionallyPublic = 0;
let protected_ = 0;

try {
  const routeFiles = findRouteFiles(APPS_DIR);

  for (const file of routeFiles) {
    const content = fs.readFileSync(file, 'utf8');
    const relPath = path.relative(process.cwd(), file);

    const hasMiddlewareExport = /export\s+(const|let|var)\s+middleware\b/.test(content);
    const hasRequirePermission = /requirePermission\s*\(/.test(content);
    const hasMiddlewareFalse = /middleware\s*=\s*false/.test(content);
    const hasMiddlewareArray = /middleware\s*=\s*\[/.test(content);

    if (hasRequirePermission || hasMiddlewareArray) {
      console.log(`✅ ${relPath}`);
      protected_++;
    } else if (hasMiddlewareFalse) {
      console.log(`⚪ ${relPath} — middleware = false (intentionally public)`);
      intentionallyPublic++;
    } else if (!hasMiddlewareExport) {
      console.log(`🔴 ${relPath} — NO middleware export`);
      unprotected++;
    } else {
      console.log(`🟡 ${relPath} — middleware exported but no requirePermission()`);
      unprotected++;
    }
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

console.log('\n═══════════════════════════════════════════════════');
console.log(`  Protected:           ${protected_}`);
console.log(`  Intentionally public: ${intentionallyPublic}`);
console.log(`  Unprotected:         ${unprotected}`);
console.log('═══════════════════════════════════════════════════');
process.exit(unprotected > 0 ? 1 : 0);
