#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * MAC & WINDOWS CASE SENSITIVITY FIXER
 * Git (with core.ignorecase=true) does not detect when you rename a file's casing.
 * This script loops through all files Git tracks and compares their exact casing
 * against the physical filesystem. If a discrepancy is found, it forcefully updates Gits tracking.
 */

function checkAndFixCasing() {
  console.log('🔍 Checking for Git/Filesystem casing mismatches...');

  let files;
  try {
    // Get all files currently tracked by git or staged
    files = execSync('git ls-files')
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch (error) {
    console.error('❌ Failed to get git files');
    process.exit(1);
  }

  let mismatchCount = 0;

  for (const file of files) {
    if (!fs.existsSync(file)) continue; // Skip files deleted from disk but still in git

    const dir =
      path.dirname(file) === '.'
        ? process.cwd()
        : path.join(process.cwd(), path.dirname(file));
    const gitBase = path.basename(file);

    try {
      const diskFiles = fs.readdirSync(dir);
      const diskMatch = diskFiles.find(
        f => f.toLowerCase() === gitBase.toLowerCase(),
      );

      if (diskMatch && diskMatch !== gitBase) {
        mismatchCount++;
        const correctDiskPath = path.join(
          path.dirname(file) === '.' ? '' : path.dirname(file),
          diskMatch,
        );

        console.log(`\n⚠️  Mismatch Detected:`);
        console.log(`   - Git tracked   : ${file}`);
        console.log(`   - Disk physical : ${correctDiskPath}`);
        console.log(`   ⚙️  Applying git mv -f...`);

        // Execute the fix
        execSync(`git mv -f "${file}" "${correctDiskPath}"`);
        console.log(`   ✅ Fixed! Git now matches disk casing.`);
      }
    } catch (e) {
      // Ignore access errors
    }
  }

  if (mismatchCount === 0) {
    console.log('✅ All tracked files perfectly match filesystem casing.');
  } else {
    console.log(
      `\n🎉 Successfully fixed ${mismatchCount} case sensitivity conflict(s).`,
    );
  }
}

checkAndFixCasing();
