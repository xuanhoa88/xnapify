/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * E2E Test Runner — Compiler
 *
 * Compiles natural-language test steps into reusable script.json files.
 * Uses LLM on first compile; subsequent runs use the cached script.
 *
 * Flow:
 *   test.md → [LLM compile] → script.json + .test-hash
 *   test.md changed? → archive old script → recompile
 *
 * Directory layout:
 *   {testCaseDir}/
 *     test.md          ← manual test case
 *     script.json      ← compiled automation actions
 *     .test-hash       ← sha256 of test.md at compile time
 *     scripts/         ← archived old scripts
 *       {timestamp}.json
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SCRIPT_FILE = 'script.json';
const HASH_FILE = '.test-hash';
const TEST_FILE = 'test.md';
const ARCHIVE_DIR = 'scripts';
const SCRIPT_VERSION = 1;
const MAX_ARCHIVES = 5;

const { parseTestFile } = require('./parser');

/**
 * Compute a logical SHA256 hash of the test.md content.
 * Hashes ONLY execution-critical sections (Steps, Expected Results, Prerequisites)
 * by parsing the markdown AST, effectively ignoring typos or changes in descriptions/notes.
 *
 * @param {string} testCaseDir Absolute path to test case directory
 * @returns {string} Hex-encoded SHA256 hash
 */
function getTestHash(testCaseDir) {
  const testFile = path.join(testCaseDir, TEST_FILE);

  // 1. Parse the structural AST of the test
  const tc = parseTestFile(testFile);

  // 2. Extract only the mandatory execution sections
  // Title is included because it provides semantic context to the LLM during generation
  const logicalPayload = JSON.stringify({
    title: tc.title,
    prerequisites: tc.prerequisites,
    steps: tc.steps,
    expectedResults: tc.expectedResults,
  });

  return crypto.createHash('sha256').update(logicalPayload).digest('hex');
}

/**
 * Read the stored hash from .test-hash file.
 *
 * @param {string} testCaseDir
 * @returns {string|null} The stored hash, or null if not found
 */
function getStoredHash(testCaseDir) {
  const hashFile = path.join(testCaseDir, HASH_FILE);
  try {
    return fs.readFileSync(hashFile, 'utf-8').trim();
  } catch {
    return null;
  }
}

/**
 * Check whether a test case needs (re)compilation.
 *
 * Returns true if:
 *   - script.json does not exist
 *   - .test-hash does not exist
 *   - .test-hash does not match current test.md hash
 *
 * @param {string} testCaseDir
 * @returns {boolean}
 */
function needsCompile(testCaseDir) {
  const scriptFile = path.join(testCaseDir, SCRIPT_FILE);
  if (!fs.existsSync(scriptFile)) return true;

  const storedHash = getStoredHash(testCaseDir);
  const currentHash = getTestHash(testCaseDir);

  // Primary: check .test-hash file
  if (storedHash) {
    return storedHash !== currentHash;
  }

  // Fallback: .test-hash is gitignored, check testHash inside script.json
  // This handles fresh clones where script.json was committed but .test-hash wasn't
  try {
    const script = JSON.parse(fs.readFileSync(scriptFile, 'utf-8'));
    if (script.testHash && script.testHash === currentHash) {
      // Restore .test-hash for future runs
      fs.writeFileSync(path.join(testCaseDir, HASH_FILE), currentHash);
      return false;
    }
  } catch {
    // Corrupted script.json — needs recompile
  }

  return true;
}

/**
 * Load a compiled script.json.
 *
 * @param {string} testCaseDir
 * @returns {{ version, compiledAt, testHash, title, actions }|null}
 */
function loadScript(testCaseDir) {
  const scriptFile = path.join(testCaseDir, SCRIPT_FILE);
  try {
    const content = fs.readFileSync(scriptFile, 'utf-8');
    const script = JSON.parse(content);
    if (!script.actions || !Array.isArray(script.actions)) {
      return null;
    }
    return script;
  } catch {
    return null;
  }
}

/**
 * Archive the current script.json to scripts/{timestamp}.json
 *
 * @param {string} testCaseDir
 * @param {string} timestamp
 */
function archiveScript(testCaseDir, timestamp) {
  const scriptFile = path.join(testCaseDir, SCRIPT_FILE);
  if (!fs.existsSync(scriptFile)) return;

  const archiveDir = path.join(testCaseDir, ARCHIVE_DIR);
  fs.mkdirSync(archiveDir, { recursive: true });

  const archiveFile = path.join(archiveDir, `${timestamp}.json`);
  fs.copyFileSync(scriptFile, archiveFile);
  console.log(`    📦 Archived old script → ${path.basename(archiveFile)}`);

  // Prune old archives — keep only the last MAX_ARCHIVES files
  try {
    const archives = fs
      .readdirSync(archiveDir)
      .filter(f => f.endsWith('.json'))
      .sort();
    if (archives.length > MAX_ARCHIVES) {
      const toDelete = archives.slice(0, archives.length - MAX_ARCHIVES);
      for (const file of toDelete) {
        fs.unlinkSync(path.join(archiveDir, file));
      }
      console.log(`    🗑️  Pruned ${toDelete.length} old archive(s)`);
    }
  } catch {
    // Non-critical — skip pruning on error
  }
}

/**
 * Compile a test case: interpret each step via LLM, save script.json + .test-hash.
 *
 * @param {object} testCase  Parsed test case from parser
 * @param {Function} interpretStep  The LLM interpreter function
 * @param {object} context  LLM context (currentUrl, prerequisites, etc.)
 * @param {string} [timestamp]  For archive naming
 * @returns {object} The compiled script object
 */
async function compileTestCase(testCase, interpretStep, context, timestamp) {
  const { testCaseDir } = testCase;

  // Archive old script if it exists
  if (fs.existsSync(path.join(testCaseDir, SCRIPT_FILE)) && timestamp) {
    archiveScript(testCaseDir, timestamp);
  }

  console.log(`    🔨 Compiling ${testCase.steps.length} steps via LLM...`);

  const actions = [];
  for (let i = 0; i < testCase.steps.length; i++) {
    const step = testCase.steps[i];
    const llmContext = {
      title: testCase.title,
      testName: testCase.title,
      currentUrl: context.currentUrl || 'unknown',
      prerequisites: testCase.prerequisites || {},
      expectedResults: testCase.expectedResults,
    };

    const action = await interpretStep(step, llmContext);
    actions.push({
      step: i + 1,
      instruction: step,
      ...action,
    });
    console.log(
      `      Step ${i + 1}: ${action.action} → ${action.description || ''}`,
    );
  }

  const testHash = getTestHash(testCaseDir);
  const script = {
    version: SCRIPT_VERSION,
    compiledAt: new Date().toISOString(),
    testHash,
    title: testCase.title,
    actions,
  };

  // Save script.json
  const scriptFile = path.join(testCaseDir, SCRIPT_FILE);
  fs.writeFileSync(scriptFile, JSON.stringify(script, null, 2));

  // Save .test-hash
  const hashFile = path.join(testCaseDir, HASH_FILE);
  fs.writeFileSync(hashFile, testHash);

  console.log(`    ✅ Compiled → script.json (${actions.length} actions)`);
  return script;
}

/**
 * Recompile a single failed step and update script.json.
 *
 * Used when a compiled action fails at runtime — reinterprets the step
 * via LLM and patches the script.
 *
 * @param {object} testCase    Parsed test case
 * @param {number} stepIndex   0-based index of the failed step
 * @param {Function} interpretStep  LLM interpreter
 * @param {object} context     LLM context
 * @returns {object} The new action for this step
 */
async function recompileStep(testCase, stepIndex, interpretStep, context) {
  const step = testCase.steps[stepIndex];
  console.log(`    🔄 Recompiling step ${stepIndex + 1} via LLM...`);

  const llmContext = {
    title: testCase.title,
    testName: testCase.title,
    currentUrl: context.currentUrl || 'unknown',
    prerequisites: testCase.prerequisites || {},
    expectedResults: testCase.expectedResults,
  };

  const action = await interpretStep(step, llmContext);
  const newAction = {
    step: stepIndex + 1,
    instruction: step,
    ...action,
  };

  // Patch script.json
  const script = loadScript(testCase.testCaseDir);
  if (script && script.actions[stepIndex]) {
    script.actions[stepIndex] = newAction;
    script.compiledAt = new Date().toISOString();
    const scriptFile = path.join(testCase.testCaseDir, SCRIPT_FILE);
    fs.writeFileSync(scriptFile, JSON.stringify(script, null, 2));
  }

  console.log(
    `    ✅ Recompiled step ${stepIndex + 1}: ${action.action} → ${action.description || ''}`,
  );
  return newAction;
}

module.exports = {
  getTestHash,
  getStoredHash,
  needsCompile,
  loadScript,
  archiveScript,
  compileTestCase,
  recompileStep,
  SCRIPT_FILE,
  HASH_FILE,
  SCRIPT_VERSION,
};
