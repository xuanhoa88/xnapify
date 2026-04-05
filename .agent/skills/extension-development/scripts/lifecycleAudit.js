#!/usr/bin/env node

/**
 * Boot/Shutdown Symmetry Audit
 *
 * Scans extension directories for boot() and shutdown() hooks,
 * counts registrations vs unregistrations, and flags mismatches.
 *
 * Usage: node .agent/skills/extension-development/scripts/lifecycleAudit.js [extensionsDir]
 * Default: src/extensions/
 */

const fs = require('fs');
const path = require('path');
const { SKIP_DIRS, JS_EXTENSIONS, walkFiles } = require('../../scripts/constants');

const EXTENSIONS_DIR = process.argv[2] || path.join(process.cwd(), 'src/extensions');

// Patterns to count
const REGISTER_PATTERNS = [
  /registerHook\(/g,
  /registerSlot\(/g,
  /\.on\(/g,
  /registerHandler\(/g,
];

const UNREGISTER_PATTERNS = [
  /unregisterHook\(/g,
  /unregisterSlot\(/g,
  /\.off\(/g,
  /unregisterHandler\(/g,
];

const WORKER_PATTERNS = [
  /createWorkerPool\(/g,
];

const CLEANUP_PATTERNS = [
  /\.cleanup\(\)/g,
  /\.destroy\(\)/g,
];

function countMatches(content, patterns) {
  let total = 0;
  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches) total += matches.length;
  }
  return total;
}

function findJSFiles(dir) {
  return walkFiles(dir, JS_EXTENSIONS);
}

function extractFunctionBody(content, funcName) {
  // Simple extraction — finds function/method body
  const patterns = [
    new RegExp(`(?:async\\s+)?${funcName}\\s*\\([^)]*\\)\\s*\\{`, 'g'),
    new RegExp(`${funcName}\\s*:\\s*(?:async\\s+)?function\\s*\\([^)]*\\)\\s*\\{`, 'g'),
    new RegExp(`${funcName}\\s*:\\s*(?:async\\s+)?\\([^)]*\\)\\s*=>\\s*\\{`, 'g'),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(content);
    if (match) {
      let depth = 1;
      let i = match.index + match[0].length;
      const start = i;
      while (i < content.length && depth > 0) {
        if (content[i] === '{') depth++;
        if (content[i] === '}') depth--;
        i++;
      }
      return content.substring(start, i - 1);
    }
  }
  return '';
}

// Audit each extension
console.log('═══════════════════════════════════════════════════');
console.log('  Boot/Shutdown Symmetry Audit');
console.log('═══════════════════════════════════════════════════\n');

let totalIssues = 0;

try {
  const extensions = fs.readdirSync(EXTENSIONS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const ext of extensions) {
    const extDir = path.join(EXTENSIONS_DIR, ext.name);
    const files = findJSFiles(extDir);
    const allContent = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');

    // Find boot and shutdown bodies
    const bootBody = extractFunctionBody(allContent, 'boot');
    const shutdownBody = extractFunctionBody(allContent, 'shutdown');

    const bootRegistrations = countMatches(bootBody, REGISTER_PATTERNS);
    const shutdownUnregistrations = countMatches(shutdownBody, UNREGISTER_PATTERNS);
    const workerCreations = countMatches(allContent, WORKER_PATTERNS);
    const workerCleanups = countMatches(shutdownBody, CLEANUP_PATTERNS);

    const issues = [];

    if (bootRegistrations > 0 && shutdownUnregistrations === 0 && shutdownBody.length === 0) {
      issues.push(`🔴 boot() has ${bootRegistrations} registration(s) but no shutdown() found`);
    } else if (bootRegistrations > shutdownUnregistrations) {
      issues.push(`🟡 boot() has ${bootRegistrations} registration(s) but shutdown() only has ${shutdownUnregistrations} unregistration(s)`);
    }

    if (workerCreations > 0 && workerCleanups === 0) {
      issues.push(`🔴 createWorkerPool() called but no cleanup()/destroy() in shutdown()`);
    }

    // Report
    const status = issues.length === 0 ? '✅' : '❌';
    console.log(`${status} ${ext.name}`);
    if (bootBody) console.log(`   boot():     ${bootRegistrations} registration(s)`);
    if (shutdownBody) console.log(`   shutdown(): ${shutdownUnregistrations} unregistration(s)`);
    if (workerCreations > 0) console.log(`   workers:    ${workerCreations} pool(s), ${workerCleanups} cleanup(s)`);

    for (const issue of issues) {
      console.log(`   ${issue}`);
      totalIssues++;
    }
    console.log();
  }
} catch (err) {
  console.error(`Error reading ${EXTENSIONS_DIR}: ${err.message}`);
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════');
console.log(`  Total issues: ${totalIssues}`);
console.log('═══════════════════════════════════════════════════');
process.exit(totalIssues > 0 ? 1 : 0);
