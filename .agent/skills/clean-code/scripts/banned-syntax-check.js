#!/usr/bin/env node

/**
 * Banned Syntax Check
 *
 * Greps source files for ESLint-banned syntax:
 * - ?? (nullish coalescing)
 * - ??= (nullish assignment)
 * - ?. (optional chaining)
 *
 * Usage: node .agent/skills/clean-code/scripts/banned-syntax-check.js [srcDir]
 * Default: src/
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = process.argv[2] || path.join(process.cwd(), 'src');

// Directories to skip
const SKIP_DIRS = new Set(['node_modules', '.cache', 'build', 'dist', '.git', 'translations']);

function findJSFiles(dir) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findJSFiles(full));
      } else if (entry.isFile() && /\.[cm]?[jt]sx?$/i.test(entry.name) && !entry.name.endsWith('.test.js')) {
        results.push(full);
      }
    }
  } catch {
    // Skip unreadable
  }
  return results;
}

// Patterns with context-aware matching (avoid false positives in strings/comments)
const BANNED_PATTERNS = [
  {
    name: '?? (nullish coalescing)',
    // Match ?? but not inside strings or comments
    regex: /(?<!=)\?\?(?!=)/g,
    fix: 'x != null ? x : fallback',
  },
  {
    name: '??= (nullish assignment)',
    regex: /\?\?=/g,
    fix: 'if (x == null) x = value',
  },
  {
    name: '?. (optional chaining)',
    regex: /\?\./g,
    fix: 'x && x.prop (or guard clause)',
  },
];

console.log('═══════════════════════════════════════════════════');
console.log('  Banned Syntax Check');
console.log('═══════════════════════════════════════════════════\n');

let totalViolations = 0;
const files = findJSFiles(SRC_DIR);

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const fileViolations = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    // Skip lines that are entirely strings
    if (/^\s*['"`].*['"`]\s*[,;]?\s*$/.test(line)) continue;

    for (const pattern of BANNED_PATTERNS) {
      const matches = line.match(pattern.regex);
      if (matches) {
        fileViolations.push({
          line: i + 1,
          pattern: pattern.name,
          fix: pattern.fix,
          code: trimmed,
        });
      }
    }
  }

  if (fileViolations.length > 0) {
    const relPath = path.relative(process.cwd(), file);
    console.log(`❌ ${relPath}`);
    for (const v of fileViolations) {
      console.log(`   L${v.line}: ${v.pattern}`);
      console.log(`   ${v.code}`);
      console.log(`   Fix: Use \`${v.fix}\` instead\n`);
    }
    totalViolations += fileViolations.length;
  }
}

console.log('═══════════════════════════════════════════════════');
console.log(`  Files scanned: ${files.length}`);
console.log(`  Total violations: ${totalViolations}`);
console.log('═══════════════════════════════════════════════════');
process.exit(totalViolations > 0 ? 1 : 0);
