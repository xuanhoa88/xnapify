#!/usr/bin/env node

/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * E2E Test Runner
 *
 * Reads natural language .md test cases from each module's e2e/ folder,
 * launches Chromium via Puppeteer, and executes them step by step.
 *
 * Usage:
 *   node tools/e2e/runner.js                        # Run all e2e tests
 *   node tools/e2e/runner.js extensions              # Run extensions module
 *   node tools/e2e/runner.js oauth-google-plugin     # Run specific extension
 *   node tools/e2e/runner.js extensions/02-activate  # Run specific file
 *   node tools/e2e/runner.js --headed                # Show browser window
 *   node tools/e2e/runner.js --clear-cache            # Clear LLM cache + run all
 *
 * Environment:
 *   E2E_PORT=1337          # App port (auto-detected from .env)
 *   E2E_HEADLESS=false     # Show browser (fallback; prefer --headed flag)
 *   E2E_FIXTURE_ZIP=...    # Path to test extension .zip
 *   E2E_EMAIL=admin@...    # Login email (fallback — prefer YAML front-matter)
 *   E2E_PASSWORD=secret    # Login password (fallback — prefer YAML front-matter)
 *
 * LLM Interpreter:
 *   E2E_LLM_PROVIDER=auto  # auto (default) | stdin | openai | anthropic | google | ollama | custom
 *   E2E_LLM_API_KEY=...    # Override auto-detected key
 *   E2E_LLM_MODEL=...      # Model name (optional, has defaults)
 *   E2E_LLM_BASE_URL=...   # Base URL (for custom/ollama)
 */

/* eslint-disable no-console */

const fs = require('fs');
const http = require('http');
const path = require('path');

const puppeteer = require('puppeteer');

const config = require('../config');

const { executeAction } = require('./executor');
const { interpretStep } = require('./llm-interpreter');
const {
  parseTestFile,
  discoverTestFiles,
  findAllE2eDirs,
} = require('./parser');
const {
  createResultsDir,
  writeTestResult,
  writeSummary,
} = require('./reporter');

const ROOT_DIR = config.CWD || process.cwd();

// ── Config ────────────────────────────────────────────────────────

function resolvePort() {
  // Priority 1: env var
  const e2ePort = config.env('E2E_PORT');
  if (e2ePort) return e2ePort;

  // Priority 2: .env files
  const envFiles = ['.env', '.env.test', '.env.development', '.env.local'];
  let port = '1337';
  for (const file of envFiles) {
    const filePath = path.join(ROOT_DIR, file);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^XNAPIFY_PORT=(\d+)/m);
    if (match) port = match[1];
  }
  return port;
}

function resolveTarget(arg) {
  if (!arg) return findAllE2eDirs(ROOT_DIR);

  // Check if it's a specific file path like "extensions/02-activate"
  if (arg.includes('/')) {
    const [mod, file] = arg.split('/');
    const dirs = [
      path.join(ROOT_DIR, 'src', 'apps', mod, 'e2e'),
      path.join(ROOT_DIR, 'src', 'extensions', mod, 'e2e'),
    ];
    for (const dir of dirs) {
      const filePath = path.join(dir, `${file}.md`);
      if (fs.existsSync(filePath)) return [{ dir, files: [filePath] }];
    }
    console.error(`❌ Test file not found: ${arg}`);
    process.exit(1);
  }

  // Module or extension name
  const dirs = [
    path.join(ROOT_DIR, 'src', 'apps', arg, 'e2e'),
    path.join(ROOT_DIR, 'src', 'extensions', arg, 'e2e'),
  ];
  const found = dirs.filter(d => fs.existsSync(d));
  if (found.length === 0) {
    console.error(`❌ No e2e/ directory found for: ${arg}`);
    console.error(`   Searched: ${dirs.join(', ')}`);
    process.exit(1);
  }
  return found;
}

// ── Main ──────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const clearCache = args.includes('--clear-cache');
  const headed = args.includes('--headed');
  const targetArg = args.find(a => !a.startsWith('--'));
  const port = resolvePort();
  const baseUrl = `http://localhost:${port}`;
  const headless = headed ? false : config.env('E2E_HEADLESS') !== 'false';
  const timestamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[T:]/g, '_')
    .replace(/-/g, '-');

  // Clear LLM step cache if requested
  if (clearCache) {
    const cacheFile = path.join(__dirname, '.step-cache.json');
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
      console.log('🗑️  Cleared LLM step cache');
    }
  }

  const llmProvider = config.env('E2E_LLM_PROVIDER') || 'auto';

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║         E2E Test Runner              ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Port:     ${port}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Headless: ${headless}`);
  console.log(`  Target:   ${targetArg || 'all'}`);
  console.log(`  LLM:      ${llmProvider}`);
  if (llmProvider === 'auto') {
    console.log(
      '  Note:     Auto-detecting LLM from env (GEMINI_API_KEY, OPENAI_API_KEY, etc.)',
    );
  }
  console.log('');

  // Validate LLM connectivity before launching browser
  // Resolve auto-detect early to check if Ollama is needed
  let resolvedLLM = llmProvider;
  if (llmProvider === 'auto') {
    // Peek at which provider auto-detect will choose
    const hasGemini =
      config.env('GEMINI_API_KEY') || config.env('GOOGLE_API_KEY');
    const hasOpenAI = config.env('OPENAI_API_KEY');
    const hasAnthropic = config.env('ANTHROPIC_API_KEY');
    resolvedLLM = hasGemini
      ? 'google'
      : hasOpenAI
        ? 'openai'
        : hasAnthropic
          ? 'anthropic'
          : 'ollama';
    console.log(`  🔍 Auto-detected LLM: ${resolvedLLM}`);
  }

  if (resolvedLLM === 'ollama') {
    const ollamaUrl =
      config.env('E2E_LLM_BASE_URL') || 'http://localhost:11434';
    try {
      await new Promise((resolve, reject) => {
        const req = http.request(
          `${ollamaUrl}/api/tags`,
          { method: 'GET', timeout: 5000 },
          res => {
            res.resume();
            resolve();
          },
        );
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('timeout'));
        });
        req.end();
      });
      console.log('  ✅ Ollama is running');
    } catch {
      console.error(`  ❌ Ollama not reachable at ${ollamaUrl}`);
      console.error('     Start with: ollama serve');
      console.error(
        '     Or set GEMINI_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY',
      );
      process.exit(1);
    }
  }
  console.log('');

  // Resolve target directories
  const targetDirs = resolveTarget(targetArg);
  if (Array.isArray(targetDirs) && targetDirs.length === 0) {
    console.log('No e2e/ directories found. Nothing to test.');
    return;
  }

  // Collect all test files
  const allDirs = Array.isArray(targetDirs[0]) ? targetDirs : targetDirs;
  let testFiles = [];
  for (const dir of allDirs) {
    const dirPath = typeof dir === 'string' ? dir : dir.dir;
    if (typeof dir === 'object' && dir.files) {
      testFiles.push(...dir.files.map(f => ({ file: f, e2eDir: dirPath })));
    } else {
      const files = discoverTestFiles([dirPath]);
      testFiles.push(...files.map(f => ({ file: f, e2eDir: dirPath })));
    }
  }

  if (testFiles.length === 0) {
    console.log('No .md test case files found.');
    return;
  }

  console.log(`📋 Found ${testFiles.length} test file(s):`);
  testFiles.forEach(t => console.log(`   ${path.relative(ROOT_DIR, t.file)}`));
  console.log('');

  // Launch browser
  const browser = await puppeteer.launch({
    headless,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,900',
    ],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(30000);

  // Group files by e2e directory (module)
  const byModule = new Map();
  for (const t of testFiles) {
    if (!byModule.has(t.e2eDir)) byModule.set(t.e2eDir, []);
    byModule.get(t.e2eDir).push(t.file);
  }

  const allResults = [];

  for (const [e2eDir, files] of byModule) {
    const moduleName = path.basename(path.dirname(e2eDir));
    const resultsDir = createResultsDir(e2eDir, timestamp);

    console.log(`\n━━━ Module: ${moduleName} ━━━`);
    console.log(`    Results: ${path.relative(ROOT_DIR, resultsDir)}`);

    const moduleResults = [];

    for (const file of files) {
      const suite = parseTestFile(file);
      const filePrefix = path.basename(file, '.md');

      console.log(`\n  📄 ${suite.file} — ${suite.phase}`);

      for (let i = 0; i < suite.tests.length; i++) {
        const tc = suite.tests[i];
        const startTime = Date.now();
        const stepResults = [];
        let testPassed = true;
        let testError = '';

        console.log(`    🧪 ${tc.name}`);
        if (Object.keys(tc.prerequisites || {}).length > 0) {
          const prereqStr = Object.entries(tc.prerequisites)
            .map(([k, v]) => `${k}=${k === 'password' ? '***' : v}`)
            .join(', ');
          console.log(`       📋 Prerequisites: ${prereqStr}`);
        }

        const context = {
          page,
          baseUrl,
          currentCard: null,
          prerequisites: tc.prerequisites || {},
          fixtureZip:
            (tc.prerequisites || {}).fixture_zip ||
            config.env('E2E_FIXTURE_ZIP'),
        };

        const TEST_TIMEOUT = 120000; // 2 minutes per test case
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(`Test case timed out after ${TEST_TIMEOUT / 1000}s`),
              ),
            TEST_TIMEOUT,
          );
        });

        const stepsPromise = (async () => {
          for (let s = 0; s < tc.steps.length; s++) {
            const step = tc.steps[s];
            console.log(`      🤖 Step ${s + 1}: "${step}"`);
            const llmContext = {
              phase: suite.phase,
              testName: tc.name,
              currentUrl: page.url(),
              prerequisites: tc.prerequisites || {},
            };
            const action = await interpretStep(step, llmContext);
            console.log(
              `         → ${action.action}: ${action.description || ''}`,
            );
            const actionResult = await executeAction(action, context);
            if (!actionResult.success) {
              throw new Error(actionResult.error);
            }
            stepResults.push({
              success: true,
              note: `${action.action}: ${action.description || ''}`,
            });
            console.log(`      ✅ Step ${s + 1}: done`);
          }
        })();

        try {
          await Promise.race([stepsPromise, timeoutPromise]);
        } catch (err) {
          stepResults.push({ success: false, error: err.message });
          testPassed = false;
          testError = err.message;
          console.log(`      ❌ Failed: ${err.message}`);
        }

        // Screenshot
        const screenshotName = `${filePrefix}_${i + 1}.png`;
        const screenshotPath = path.join(resultsDir, screenshotName);
        try {
          await page.screenshot({ path: screenshotPath, fullPage: true });
        } catch {
          // Screenshot may fail in some states
        }

        const duration = Date.now() - startTime;
        const result = {
          testName: tc.name,
          filePrefix,
          passed: testPassed,
          error: testError,
          duration,
          steps: stepResults,
          screenshotPath,
          sourceFile: path.relative(ROOT_DIR, file),
          timestamp: new Date().toISOString(),
        };

        writeTestResult(resultsDir, filePrefix, tc, result);
        moduleResults.push(result);
        allResults.push(result);

        const icon = testPassed ? '✅' : '❌';
        console.log(`    ${icon} ${tc.name} (${duration}ms)`);
      }
    }

    // Module summary
    writeSummary(resultsDir, moduleName, moduleResults, { timestamp, port });
    const passed = moduleResults.filter(r => r.passed).length;
    console.log(
      `\n  📊 ${moduleName}: ${passed}/${moduleResults.length} passed`,
    );
  }

  await browser.close();

  // Final summary
  const totalPassed = allResults.filter(r => r.passed).length;
  const totalTests = allResults.length;
  const totalDuration = allResults.reduce((s, r) => s + (r.duration || 0), 0);

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log(
    `║  Results: ${totalPassed}/${totalTests} passed (${totalDuration}ms)      ║`,
  );
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  process.exit(totalPassed === totalTests ? 0 : 1);
}

run().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
