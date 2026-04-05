#!/usr/bin/env node

/**
 * Cross-Domain Import Check
 *
 * Scans src/apps/ modules for illegal cross-domain imports.
 * Each module should only import from its own directory or shared/.
 *
 * Usage: node .agent/skills/code-review/scripts/isolationCheck.js [appsDir]
 * Default: src/apps/
 */

const fs = require('fs');
const path = require('path');
const { JS_EXTENSIONS, walkFiles } = require('../../scripts/constants');

const APPS_DIR = process.argv[2] || path.join(process.cwd(), 'src/apps');

function findJSFiles(dir) {
  return walkFiles(dir, JS_EXTENSIONS);
}

console.log('═══════════════════════════════════════════════════');
console.log('  Cross-Domain Import Check');
console.log('═══════════════════════════════════════════════════\n');

let totalViolations = 0;

try {
  const modules = fs.readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const mod of modules) {
    const moduleDir = path.join(APPS_DIR, mod.name);
    const files = findJSFiles(moduleDir);
    const violations = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for imports from other @apps/ modules
        const importMatch = line.match(/(?:from|require\()\s*['"]@apps\/([^/'"]+)/);
        if (importMatch) {
          const importedModule = importMatch[1];
          if (importedModule !== mod.name) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: i + 1,
              importedModule,
              code: line.trim(),
            });
          }
        }

        // Check for relative imports that escape the module directory
        const relMatch = line.match(/(?:from|require\()\s*['"](\.\.[^'"]*apps\/([^/'"]+))/);
        if (relMatch) {
          const importedModule = relMatch[2];
          if (importedModule !== mod.name) {
            violations.push({
              file: path.relative(process.cwd(), file),
              line: i + 1,
              importedModule,
              code: line.trim(),
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      console.log(`❌ ${mod.name} — ${violations.length} cross-domain import(s)`);
      for (const v of violations) {
        console.log(`   ${v.file}:${v.line}`);
        console.log(`   → imports from @apps/${v.importedModule}`);
        console.log(`   ${v.code}\n`);
      }
      totalViolations += violations.length;
    } else {
      console.log(`✅ ${mod.name}`);
    }
  }
} catch (err) {
  console.error(`Error reading ${APPS_DIR}: ${err.message}`);
  process.exit(1);
}

console.log('\n═══════════════════════════════════════════════════');
console.log(`  Total violations: ${totalViolations}`);
console.log('═══════════════════════════════════════════════════');
process.exit(totalViolations > 0 ? 1 : 0);
