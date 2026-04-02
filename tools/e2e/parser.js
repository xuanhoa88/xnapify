/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * E2E Test Runner — Markdown Parser
 *
 * Parses test.md files using front-matter (YAML) and markdown-it (AST).
 *
 * Directory structure:
 *   e2e/
 *     {category}/
 *       {NN-name}/
 *         test.md              → test case definition
 *         script.json          → compiled automation actions
 *         .test-hash           → sha256 of test.md at compile time
 *         results/             → test run results
 *           {timestamp}/       → grouped by execution time
 *             result.md
 *             step-01.png
 *             final.png
 *
 * test.md format:
 *   ---
 *   email: admin@test.com      → prerequisites (credentials, fixtures)
 *   password: admin123
 *   role: admin
 *   ---
 *   # Test Case Title          → the test case name (one per file)
 *   Description text            → what this test validates
 *   ## Steps                    → executable steps (numbered list)
 *   1. Navigate to the page
 *   2. Click the button
 *   ## Expected Results         → acceptance criteria (bullet list)
 *   - The page shows a success message
 *   - The item appears in the list
 *   ### Prerequisite            → per-test prerequisites (merged with YAML)
 *   - fixture_zip: ./path.zip
 */

const fs = require('fs');
const path = require('path');

const fm = require('front-matter');
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt();

/**
 * Parse a single test.md file into a structured test case.
 *
 * @param {string} filePath Absolute path to the test.md file
 * @returns {{ title, description, prerequisites, steps, expectedResults, file, category, caseName, testCaseDir }}
 */
function parseTestFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Extract YAML front-matter (prerequisites)
  const { attributes: filePrereqs, body } = fm(raw);

  // Parse markdown body into tokens
  const tokens = md.parse(body, {});

  // Derive category and case name from directory structure
  // e.g., /path/e2e/login/01-buttons-visible/test.md
  const testCaseDir = path.dirname(filePath);
  const caseName = path.basename(testCaseDir);
  const category = path.basename(path.dirname(testCaseDir));

  let title = caseName;
  let description = '';
  const steps = [];
  const expectedResults = [];
  const prerequisites = {};

  // Track which H2 section we're inside
  let currentSection = null; // 'steps' | 'expected' | null
  let inPrerequisite = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // H1 — test case title (one per file)
    if (token.type === 'heading_open' && token.tag === 'h1') {
      const inline = tokens[i + 1];
      if (inline && inline.type === 'inline') {
        title = inline.content.trim();
      }
      i += 2;
      currentSection = null;
      inPrerequisite = false;
      continue;
    }

    // H2 — section headers (Steps, Expected Results)
    if (token.type === 'heading_open' && token.tag === 'h2') {
      const inline = tokens[i + 1];
      const heading =
        inline && inline.type === 'inline'
          ? inline.content.trim().toLowerCase()
          : '';

      if (/^(steps?|test\s+steps?)$/i.test(heading)) {
        currentSection = 'steps';
      } else if (/^expected\s+results?$/i.test(heading)) {
        currentSection = 'expected';
      } else {
        currentSection = null;
      }
      i += 2;
      inPrerequisite = false;
      continue;
    }

    // H3 — sub-section headers (Prerequisite)
    if (token.type === 'heading_open' && token.tag === 'h3') {
      const inline = tokens[i + 1];
      const heading =
        inline && inline.type === 'inline'
          ? inline.content.trim().toLowerCase()
          : '';
      inPrerequisite = /^pre[-\s]?requisites?$/i.test(heading);
      i += 2;
      continue;
    }

    // Ordered list — test steps (inside ## Steps section)
    if (token.type === 'ordered_list_open' && currentSection === 'steps') {
      i++;
      while (i < tokens.length && tokens[i].type !== 'ordered_list_close') {
        if (tokens[i].type === 'list_item_open') {
          const contentToken = findInlineContent(tokens, i);
          if (contentToken) {
            steps.push(contentToken.content.trim());
          }
        }
        i++;
      }
      continue;
    }

    // Bullet list — expected results OR prerequisites
    if (token.type === 'bullet_list_open') {
      i++;
      while (i < tokens.length && tokens[i].type !== 'bullet_list_close') {
        if (tokens[i].type === 'list_item_open') {
          const contentToken = findInlineContent(tokens, i);
          if (contentToken) {
            const text = contentToken.content.trim();

            if (inPrerequisite) {
              const kvMatch = text.match(/^(\w[\w\s]*?):\s+(.+)$/);
              if (kvMatch) {
                const key = kvMatch[1]
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, '_');
                prerequisites[key] = kvMatch[2].trim();
              }
            } else if (currentSection === 'expected') {
              expectedResults.push(text);
            }
          }
        }
        i++;
      }
      continue;
    }

    // Paragraph — description text (only before any H2 section)
    if (token.type === 'paragraph_open' && currentSection === null) {
      const inline = tokens[i + 1];
      if (inline && inline.type === 'inline') {
        const text = inline.content.trim();
        description += (description ? ' ' : '') + text;
      }
      i += 2;
      continue;
    }
  }

  // Merge file-level YAML prerequisites with inline ones
  const mergedPrereqs = { ...filePrereqs, ...prerequisites };

  // Compute file path relative to e2e/ directory
  // For typed: e2e/api/auth/01-login → "api/auth/01-login/test.md"
  // For legacy: e2e/login/01-buttons → "login/01-buttons/test.md"
  let relativeFile = `${category}/${caseName}/test.md`;
  const parts = testCaseDir.split(path.sep);
  const e2eIdx = parts.lastIndexOf('e2e');
  if (e2eIdx !== -1 && e2eIdx + 1 < parts.length) {
    relativeFile = parts.slice(e2eIdx + 1).join('/') + '/test.md';
  }

  return {
    title,
    description,
    prerequisites: mergedPrereqs,
    steps,
    expectedResults,
    file: relativeFile,
    category,
    caseName,
    testCaseDir,
    testType: detectTestType(testCaseDir),
  };
}

/**
 * Walk forward from a list_item_open to find the inline content token.
 */
function findInlineContent(tokens, startIdx) {
  for (let j = startIdx + 1; j < tokens.length; j++) {
    if (tokens[j].type === 'list_item_close') break;
    if (tokens[j].type === 'inline') return tokens[j];
  }
  return null;
}

/**
 * Discover all test.md files inside an e2e directory.
 *
 * Walks: e2e/{category}/{case}/test.md
 *
 * @param {string[]} dirs Array of e2e directory paths
 * @returns {string[]} Sorted array of absolute paths to test.md files
 */
function discoverTestFiles(dirs) {
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;

    // Walk category directories
    const categories = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_'));

    for (const cat of categories) {
      const catDir = path.join(dir, cat.name);
      const cases = fs
        .readdirSync(catDir, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('_'));

      for (const tc of cases) {
        const testFile = path.join(catDir, tc.name, 'test.md');
        if (fs.existsSync(testFile)) {
          files.push(testFile);
        }
      }
    }
  }
  return files.sort();
}

function findAllE2eDirs(rootDir) {
  const results = [];
  const searchDirs = [
    path.join(rootDir, 'src', 'apps'),
    path.join(rootDir, 'src', 'extensions'),
  ];

  for (const searchDir of searchDirs) {
    if (!fs.existsSync(searchDir)) continue;
    const modules = fs.readdirSync(searchDir, { withFileTypes: true });
    for (const mod of modules) {
      if (!mod.isDirectory()) continue;
      const e2eDir = path.join(searchDir, mod.name, 'e2e');
      if (fs.existsSync(e2eDir)) {
        results.push(e2eDir);
      }
    }
  }

  return results.sort();
}

/**
 * Detect the test type from the directory structure.
 *
 * Convention:
 *   e2e/api/{category}/{case}     → 'api'   (HTTP-only, no browser)
 *   e2e/ui/{category}/{case}      → 'ui'    (browser via Puppeteer)
 *   e2e/system/{category}/{case}  → 'system' (browser + HTTP combined)
 *   e2e/{category}/{case}         → 'ui'    (backward compatible default)
 *
 * @param {string} testCaseDir  Absolute path to test case directory
 * @returns {'ui'|'api'|'system'}
 */
function detectTestType(testCaseDir) {
  const parts = testCaseDir.split(path.sep);
  const e2eIdx = parts.lastIndexOf('e2e');
  if (e2eIdx === -1 || e2eIdx + 1 >= parts.length) return 'ui';

  const typeDir = parts[e2eIdx + 1];
  if (['api', 'ui', 'system'].includes(typeDir)) return typeDir;
  return 'ui'; // backward compatible default
}

module.exports = {
  parseTestFile,
  discoverTestFiles,
  findAllE2eDirs,
  detectTestType,
};
