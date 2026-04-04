#!/usr/bin/env node

/**
 * File Naming Format Check
 *
 * Scans directories for .js files to ensure they follow camelCase format
 * and DO NOT use kebab-case (hyphens).
 *
 * Usage: node .agent/skills/clean-code/scripts/fileNamingFormatCheck.js [dirs...]
 * Default: src/ shared/ tools/
 */

const fs = require('fs');
const path = require('path');

const targetDirs = process.argv.length > 2 
    ? process.argv.slice(2) 
    : ['src', 'shared', 'tools', '.agent'].map(d => path.join(process.cwd(), d));

// Directories and file patterns to ignore
const SKIP_DIRS = new Set(['node_modules', '.cache', 'build', 'dist', '.git', 'migrations', 'seeds', '__mocks__', 'translations', 'benchmarks', '.data']);
const SKIP_EXTACT_FILES = new Set(['jest-setuptest.js', '.eslintrc.js', 'package-lock.json', 'babel.config.js', 'jest.config.js']);

function findJSFiles(dir) {
    const results = [];
    try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name)) continue;
            
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                results.push(...findJSFiles(full));
            } else if (entry.isFile() && /\.[cm]?[jt]sx?$/i.test(entry.name)) {
                if (SKIP_EXTACT_FILES.has(entry.name)) continue;
                results.push(full);
            }
        }
    } catch {
        // Skip unreadable directories gracefully
    }
    return results;
}

console.log('═══════════════════════════════════════════════════');
console.log('  File Naming Format Check (camelCase Validator)');
console.log('═══════════════════════════════════════════════════\n');

let totalViolations = 0;
let filesScannedCount = 0;

for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;
    
    const files = findJSFiles(dir);
    filesScannedCount += files.length;
    
    for (const file of files) {
        const basename = path.basename(file);
        
        // Match kebab-case files like "my-component.js" or "engine-file.js"
        // Also ensure not matching something like .env-test.js or auto-generated index-react.js 
        // We look specifically for '-' 
        if (basename.includes('-') && !basename.startsWith('.')) {
            const relPath = path.relative(process.cwd(), file);
            console.log(`❌ Invalid File Name Format: ${relPath}`);
            console.log(`   Found kebab-case nomenclature ("-") in the filename.`);
            console.log(`   Fix: Rename file to standard camelCase format (e.g., camelCaseFormat.js)\n`);
            totalViolations++;
        }
    }
}

console.log('═══════════════════════════════════════════════════');
console.log(`  Files scanned: ${filesScannedCount}`);
console.log(`  Total violations: ${totalViolations}`);
console.log('═══════════════════════════════════════════════════');

process.exit(totalViolations > 0 ? 1 : 0);
