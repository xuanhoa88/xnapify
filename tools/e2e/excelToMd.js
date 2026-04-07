/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * E2E Test Case Converter — Excel to Markdown
 *
 * Reads an Excel (.xlsx) file with test cases and generates
 * test.md files in the standard e2e directory structure.
 *
 * Usage:
 *   node tools/e2e/excelToMd.js <input.xlsx> [--dry-run] [--force]
 *
 * Excel columns (11 total — A through K):
 *   A: Test ID        (e.g. TC-QA-001)
 *   B: Module         (e.g. quick-access-plugin)
 *   C: Type           (ui, api, system — default: ui)
 *   D: Category       (e.g. login, auth)
 *   E: Title          (e.g. Login API Returns Valid JWT)
 *   F: Description    (optional paragraph)
 *   G: Prerequisites  (key=value; key=value)
 *   H: Steps          (multi-line: newlines separate steps)
 *   I: Expected       (multi-line: newlines separate criteria)
 *   J: Priority       (High/Medium/Low — metadata only)
 *   K: Status         (Draft/Ready/Automated — metadata only)
 */

const fs = require('fs');
const path = require('path');

const XLSX = require('xlsx');

const ROOT_DIR = process.cwd();

// ── Column mapping ────────────────────────────────────────────────

const COLUMNS = {
  testId: 'A',
  module: 'B',
  type: 'C',
  category: 'D',
  title: 'E',
  description: 'F',
  prerequisites: 'G',
  steps: 'H',
  expectedResults: 'I',
  priority: 'J',
  status: 'K',
};

// ── Helpers ───────────────────────────────────────────────────────

/**
 * Clean up a multi-line string into an array of lines.
 * Removes empty lines and leading numbers/bullets (e.g. "1. ", "- ").
 */
function parseMultiLineText(str) {
  if (!str) return [];
  return (
    str
      .split(/\r?\n/)
      .map(line => line.trim())
      // Remove leading numbers (e.g. "1. ", "1) ") or bullets (e.g. "- ", "* ")
      .map(line => line.replace(/^(\d+[.)]\s+|[-*]\s+)/, ''))
      .filter(Boolean)
  );
}

/**
 * Parse prerequisites string: "email=admin@example.com; password=admin123"
 * Returns: { email: 'admin@example.com', password: 'admin123' }
 */
function parsePrerequisites(str) {
  if (!str || !str.trim()) return {};
  const prereqs = {};
  const pairs = str.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    const value = pair.slice(eqIdx + 1).trim();
    if (key) prereqs[key] = value;
  }
  return prereqs;
}

/**
 * Convert test ID to directory name.
 * "TC-QA-001" → "01"
 * "TC-API-003" → "03"
 * Falls back to slugified ID if no number found.
 */
function testIdToDir(testId, title) {
  // Extract trailing number
  const numMatch = testId.match(/(\d+)$/);
  const num = numMatch ? numMatch[1].padStart(2, '0') : '01';

  // Slugify title (max 30 chars, break at word boundary)
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length > 30) {
    slug = slug.slice(0, 30).replace(/-[^-]*$/, '');
  }

  return `${num}-${slug}`;
}

/**
 * Generate test.md content from a parsed row.
 */
function generateTestMd(row) {
  const lines = [];

  // YAML front-matter
  const prereqs = parsePrerequisites(row.prerequisites);
  if (Object.keys(prereqs).length > 0) {
    lines.push('---');
    for (const [key, value] of Object.entries(prereqs)) {
      lines.push(`${key}: ${value}`);
    }
    lines.push('---');
    lines.push('');
  }

  // Title
  lines.push(`# ${row.title}`);
  lines.push('');

  // Description
  if (row.description) {
    lines.push(row.description);
    lines.push('');
  }

  // Steps
  if (row.steps.length > 0) {
    lines.push('## Steps');
    lines.push('');
    row.steps.forEach((step, i) => {
      lines.push(`${i + 1}. ${step}`);
    });
    lines.push('');
  }

  // Expected Results
  if (row.expectedResults.length > 0) {
    lines.push('## Expected Results');
    lines.push('');
    row.expectedResults.forEach(result => {
      lines.push(`- ${result}`);
    });
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const inputFile = args.find(a => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  if (!inputFile) {
    console.log(
      'Usage: node tools/e2e/excelToMd.js <input.xlsx> [--dry-run] [--force]',
    );
    console.log('');
    console.log('Options:');
    console.log(
      '  --dry-run   Show what would be created without writing files',
    );
    console.log('  --force     Overwrite existing test.md files');
    console.log('');
    console.log(
      'See tools/e2e/test-cases-template.xlsx for the expected format.',
    );
    process.exit(1);
  }

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ File not found: ${inputFile}`);
    process.exit(1);
  }

  // Read Excel
  const workbook = XLSX.readFile(inputFile);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    console.error('❌ No sheets found in workbook');
    process.exit(1);
  }

  // Get range
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');

  console.log(`📊 Reading "${sheetName}" from ${inputFile}`);
  console.log(`   Rows: ${range.e.r} (excluding header)`);
  console.log('');

  const results = { created: 0, skipped: 0, errors: 0 };

  // Process rows (skip header row 0)
  for (let r = 1; r <= range.e.r; r++) {
    const cell = col => {
      const ref = `${col}${r + 1}`;
      return sheet[ref] ? String(sheet[ref].v || '').trim() : '';
    };

    const testId = cell(COLUMNS.testId);
    const module = cell(COLUMNS.module);
    const type = cell(COLUMNS.type) || 'ui';
    const category = cell(COLUMNS.category);
    const title = cell(COLUMNS.title);

    // Skip empty rows
    if (!testId || !module || !title) continue;

    // Validate type
    if (!['ui', 'api', 'system'].includes(type)) {
      console.error(
        `  ❌ Row ${r + 1} (${testId}): Invalid type "${type}" — must be ui, api, or system`,
      );
      results.errors++;
      continue;
    }

    // Collect steps (non-empty)
    const stepsStr = cell(COLUMNS.steps);
    const steps = parseMultiLineText(stepsStr);

    if (steps.length === 0) {
      console.error(`  ❌ Row ${r + 1} (${testId}): No steps defined`);
      results.errors++;
      continue;
    }

    // Collect expected results (non-empty)
    const expectedStr = cell(COLUMNS.expectedResults);
    const expectedResults = parseMultiLineText(expectedStr);

    const row = {
      testId,
      module,
      type,
      category,
      title,
      description: cell(COLUMNS.description),
      prerequisites: cell(COLUMNS.prerequisites),
      steps,
      expectedResults,
    };

    // Build target path
    const dirName = testIdToDir(testId, title);
    const typePath = type === 'ui' ? '' : type;
    const targetDir = path.join(
      ROOT_DIR,
      'src',
      'extensions',
      module,
      'e2e',
      typePath,
      category,
      dirName,
    );

    // Check for apps/ modules too
    const appsDir = path.join(ROOT_DIR, 'src', 'apps', module);
    const isApp = fs.existsSync(appsDir);
    const finalDir = isApp
      ? path.join(appsDir, 'e2e', typePath, category, dirName)
      : targetDir;
    const finalFile = path.join(finalDir, 'test.md');
    const finalRelPath = path.relative(ROOT_DIR, finalFile);

    // Check existing
    if (fs.existsSync(finalFile) && !force) {
      console.log(
        `  ⏭️  ${finalRelPath} — already exists (use --force to overwrite)`,
      );
      results.skipped++;
      continue;
    }

    // Generate content
    const content = generateTestMd(row);

    if (dryRun) {
      console.log(
        `  📝 ${finalRelPath} — would create (${steps.length} steps)`,
      );
    } else {
      fs.mkdirSync(finalDir, { recursive: true });
      fs.writeFileSync(finalFile, content, 'utf-8');
      console.log(`  ✅ ${finalRelPath} — created (${steps.length} steps)`);
    }
    results.created++;
  }

  // Summary
  console.log('');
  console.log('────────────────────────────────────────');
  console.log(`  Created: ${results.created}${dryRun ? ' (dry run)' : ''}`);
  console.log(`  Skipped: ${results.skipped}`);
  console.log(`  Errors:  ${results.errors}`);
  console.log('────────────────────────────────────────');

  if (dryRun) {
    console.log('');
    console.log('Run without --dry-run to create the files.');
  }
}

main();
