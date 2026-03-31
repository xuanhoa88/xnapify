/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * E2E Test Runner — Markdown Parser
 *
 * Parses .md test files using front-matter (YAML) and markdown-it (AST).
 *
 * Format:
 *   ---
 *   email: admin@test.com      → file-level prerequisites (shared)
 *   password: admin123
 *   role: admin
 *   ---
 *   # Phase Name               → suite name
 *   Description text            → suite description
 *   ## Test Case Title          → test case
 *   ### Prerequisite            → per-test prerequisites (merged with file-level)
 *   - fixture_zip: ./path.zip
 *   1. Step instruction         → executable step
 */

const fs = require('fs');
const path = require('path');

const fm = require('front-matter');
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt();

/**
 * Parse a single .md test file into a structured test suite.
 *
 * @param {string} filePath Absolute path to the .md file
 * @returns {{ phase, description, prerequisites, tests, file }}
 */
function parseTestFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');

  // Extract YAML front-matter (file-level prerequisites)
  const { attributes: filePrereqs, body } = fm(raw);

  // Parse markdown body into tokens
  const tokens = md.parse(body, {});

  let phase = path.basename(filePath, '.md');
  let phaseDescription = '';
  const tests = [];
  let currentTest = null;
  let inPrerequisite = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // H1 — phase/suite name
    if (token.type === 'heading_open' && token.tag === 'h1') {
      const inline = tokens[i + 1];
      if (inline && inline.type === 'inline') {
        phase = inline.content.trim();
      }
      i += 2; // skip inline + heading_close
      inPrerequisite = false;
      continue;
    }

    // H2 — new test case
    if (token.type === 'heading_open' && token.tag === 'h2') {
      if (currentTest) tests.push(currentTest);
      const inline = tokens[i + 1];
      const name =
        inline && inline.type === 'inline' ? inline.content.trim() : '';
      currentTest = {
        name,
        description: '',
        prerequisites: {},
        steps: [],
      };
      i += 2;
      inPrerequisite = false;
      continue;
    }

    // H3 — section headers (Prerequisite, etc.)
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

    // Ordered list — test steps (always treated as steps)
    if (token.type === 'ordered_list_open' && currentTest) {
      // Collect all list_item children
      i++;
      while (i < tokens.length && tokens[i].type !== 'ordered_list_close') {
        if (tokens[i].type === 'list_item_open') {
          // Next token is paragraph_open, then inline with content
          const contentToken = findInlineContent(tokens, i);
          if (contentToken) {
            currentTest.steps.push(contentToken.content.trim());
          }
        }
        i++;
      }
      inPrerequisite = false;
      continue;
    }

    // Bullet list — prerequisite key:value pairs OR steps
    if (token.type === 'bullet_list_open') {
      i++;
      while (i < tokens.length && tokens[i].type !== 'bullet_list_close') {
        if (tokens[i].type === 'list_item_open') {
          const contentToken = findInlineContent(tokens, i);
          if (contentToken) {
            const text = contentToken.content.trim();
            if (inPrerequisite && currentTest) {
              // Parse "key: value"
              const kvMatch = text.match(/^(\w[\w\s]*?):\s+(.+)$/);
              if (kvMatch) {
                const key = kvMatch[1]
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, '_');
                currentTest.prerequisites[key] = kvMatch[2].trim();
              }
            } else if (currentTest) {
              // Bullet steps
              currentTest.steps.push(text);
            }
          }
        }
        i++;
      }
      continue;
    }

    // Paragraph — description text
    if (token.type === 'paragraph_open') {
      const inline = tokens[i + 1];
      if (inline && inline.type === 'inline') {
        const text = inline.content.trim();
        if (currentTest) {
          currentTest.description +=
            (currentTest.description ? ' ' : '') + text;
        } else {
          phaseDescription += (phaseDescription ? ' ' : '') + text;
        }
      }
      i += 2;
      continue;
    }
  }

  if (currentTest) tests.push(currentTest);

  // Merge file-level prerequisites into each test case
  // Per-test prerequisites override file-level ones
  for (const test of tests) {
    test.prerequisites = { ...filePrereqs, ...test.prerequisites };
  }

  return {
    phase,
    description: phaseDescription,
    prerequisites: filePrereqs,
    tests,
    file: path.basename(filePath),
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

function discoverTestFiles(dirs) {
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    const entries = fs
      .readdirSync(dir)
      .filter(f => f.endsWith('.md') && !f.startsWith('_'))
      .sort();
    for (const entry of entries) {
      files.push(path.join(dir, entry));
    }
  }
  return files;
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

module.exports = { parseTestFile, discoverTestFiles, findAllE2eDirs };
