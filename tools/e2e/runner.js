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
 *   node tools/e2e/runner.js                         # Auto: compile if needed, run
 *   node tools/e2e/runner.js --mode=compile           # Compile scripts via LLM
 *   node tools/e2e/runner.js --mode=run               # Run from compiled scripts
 *   node tools/e2e/runner.js --mode=compile --force   # Force recompile
 *   node tools/e2e/runner.js extensions               # Run extensions module
 *   node tools/e2e/runner.js quick-access-plugin      # Run specific extension
 *   node tools/e2e/runner.js --headed                 # Show browser window
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

const config = require('../config');

const { launchBrowser, createPage, closeBrowser } = require('./browser');
const {
  needsCompile,
  loadScript,
  compileTestCase,
  recompileStep,
} = require('./compiler');
const { executeAction, createAPIState } = require('./executor');
const { interpretStep } = require('./llmInterpreter');
const {
  parseTestFile,
  discoverTestFiles,
  findAllE2eDirs,
  detectTestType,
} = require('./parser');
const {
  createTestCaseResultsDir,
  createSummaryDir,
  writeTestResult,
  writeSummary,
} = require('./reporter');

const ROOT_DIR = config.CWD || process.cwd();

const TYPE_ICONS = { ui: '🌐', api: '🔌', system: '🔗' };

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

  // Supports:
  //   "extensions"                                    → run all in extensions module
  //   "quick-access-plugin"                           → run all in quick-access-plugin
  //   "extensions/install"                            → run all in install category
  //   "extensions/install/01-upload"                  → run single test case
  //   "quick-access-plugin/login/01-buttons-visible"  → run single test case
  //   "quick-access-plugin/api"                       → run all API tests
  //   "quick-access-plugin/api/auth"                  → run all in api/auth category
  //   "quick-access-plugin/api/auth/01-login-jwt"     → run single API test case
  const parts = arg.split('/');
  const mod = parts[0];

  const e2eDirs = [
    path.join(ROOT_DIR, 'src', 'apps', mod, 'e2e'),
    path.join(ROOT_DIR, 'src', 'extensions', mod, 'e2e'),
  ];
  const e2eDir = e2eDirs.find(d => fs.existsSync(d));
  if (!e2eDir) {
    console.error(`❌ No e2e/ directory found for: ${mod}`);
    console.error(`   Searched: ${e2eDirs.join(', ')}`);
    process.exit(1);
  }

  // Remaining path after module name
  const rest = parts.slice(1);

  // Build the actual sub-path within e2e/
  const subPath = rest.join(path.sep);
  const fullPath = path.join(e2eDir, subPath);

  // Single test case: resolve to test.md
  const testFile = path.join(fullPath, 'test.md');
  if (fs.existsSync(testFile)) {
    return [{ dir: e2eDir, files: [testFile] }];
  }

  // Category or type directory: discover all cases beneath it
  if (rest.length >= 1 && fs.existsSync(fullPath)) {
    const files = discoverTestFiles([fullPath]);
    if (files.length === 0) {
      console.error(`❌ No test cases found in: ${subPath}`);
      process.exit(1);
    }
    return [{ dir: e2eDir, files }];
  }

  // Invalid sub-path
  if (rest.length >= 1) {
    console.error(`❌ Path not found: ${subPath}`);
    console.error(`   Searched: ${fullPath}`);
    process.exit(1);
  }

  // Module only: discover all
  return [e2eDir];
}

// ── Main ──────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const headed = args.includes('--headed');
  const force = args.includes('--force');
  const modeArg = args.find(a => a.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'auto'; // compile | run | auto
  const targetArg = args.find(a => !a.startsWith('--'));
  const port = resolvePort();
  const baseUrl = `http://localhost:${port}`;
  const headless = headed ? false : config.env('E2E_HEADLESS') !== 'false';
  const timestamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace(/[T:]/g, '_')
    .replace(/-/g, '-');

  const llmProvider = config.env('E2E_LLM_PROVIDER') || 'auto';

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║         E2E Test Runner              ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Port:     ${port}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Mode:     ${mode}${force ? ' (force)' : ''}`);
  console.log(`  Headless: ${headless}`);
  console.log(`  Target:   ${targetArg || 'all'}`);
  console.log(`  LLM:      ${llmProvider}`);
  if (llmProvider === 'auto') {
    console.log(
      '  Note:     Auto-detecting LLM from env (GEMINI_API_KEY, OPENAI_API_KEY, etc.)',
    );
  }
  console.log('');

  // ── Deferred LLM validation ──
  // Only validate when compilation is actually needed (not upfront).
  let resolvedLLM = llmProvider;
  let llmValidated = false;

  async function ensureLLMAvailable() {
    if (llmValidated || mode === 'run') return;
    llmValidated = true;

    if (llmProvider === 'auto') {
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
  }

  // For compile mode, validate LLM immediately (we know we'll need it)
  if (mode === 'compile') {
    await ensureLLMAvailable();
  } else if (mode === 'run') {
    console.log('  📜 Run mode — LLM not needed');
  }
  // auto mode: deferred — validate only when a test needs compilation
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

  // Launch browser only if needed (skip for compile-only or API-only tests)
  let browser = null;
  let page = null;
  const needsBrowser =
    mode !== 'compile' &&
    testFiles.some(t => {
      const type = detectTestType(path.dirname(t.file));
      return type === 'ui' || type === 'system';
    });

  if (needsBrowser) {
    browser = await launchBrowser({ headless });
    page = await createPage(browser);
  } else if (mode !== 'compile') {
    console.log('  🔌 API-only tests — no browser launched');
  }

  // Group files by e2e directory (module)
  const byModule = new Map();
  for (const t of testFiles) {
    if (!byModule.has(t.e2eDir)) byModule.set(t.e2eDir, []);
    byModule.get(t.e2eDir).push(t.file);
  }

  const allResults = [];

  for (const [e2eDir, files] of byModule) {
    const moduleName = path.basename(path.dirname(e2eDir));

    console.log(`\n━━━ Module: ${moduleName} ━━━`);

    const moduleResults = [];

    for (const file of files) {
      const tc = parseTestFile(file);
      const resultsDir =
        mode !== 'compile'
          ? createTestCaseResultsDir(tc.testCaseDir, timestamp)
          : null;
      const startTime = Date.now();
      const stepResults = [];
      let testPassed = true;
      let testError = '';

      const typeIcon = TYPE_ICONS[tc.testType] || '🌐';
      console.log(`\n  📄 ${tc.file} — ${typeIcon} ${tc.title}`);
      if (resultsDir) {
        console.log(`     📁 Results: ${path.relative(ROOT_DIR, resultsDir)}`);
      }
      if (Object.keys(tc.prerequisites || {}).length > 0) {
        const prereqStr = Object.entries(tc.prerequisites)
          .map(([k, v]) => `${k}=${k === 'password' ? '***' : v}`)
          .join(', ');
        console.log(`     📋 Prerequisites: ${prereqStr}`);
      }
      if (tc.expectedResults.length > 0) {
        console.log(
          `     🎯 Expected: ${tc.expectedResults.length} acceptance criteria`,
        );
      }

      const context = {
        page,
        apiState: createAPIState(),
        baseUrl,
        currentCard: null,
        prerequisites: tc.prerequisites || {},
        fixtureZip:
          (tc.prerequisites || {}).fixture_zip || config.env('E2E_FIXTURE_ZIP'),
      };

      const TEST_TIMEOUT = 120000; // 2 minutes per test case
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new Error(`Test case timed out after ${TEST_TIMEOUT / 1000}s`),
            ),
          TEST_TIMEOUT,
        );
      });

      // ── Resolve script (compile or load) ──
      let script = null;
      const shouldCompile =
        mode === 'compile' || force || needsCompile(tc.testCaseDir);

      if (mode === 'run' && !loadScript(tc.testCaseDir)) {
        console.log(`    ❌ No script.json found — run "--mode=compile" first`);
        stepResults.push({ success: false, error: 'No compiled script found' });
        testPassed = false;
        testError = 'No compiled script. Run --mode=compile first.';
      } else if (mode === 'compile' || (mode === 'auto' && shouldCompile)) {
        // Compile mode: call LLM for each step, save script.json
        await ensureLLMAvailable();
        try {
          script = await compileTestCase(
            tc,
            interpretStep,
            { currentUrl: page ? page.url() : 'about:blank' },
            timestamp,
          );
          if (mode === 'compile') {
            console.log(`  ✅ ${tc.title} — compiled`);
          }
        } catch (err) {
          stepResults.push({ success: false, error: err.message });
          testPassed = false;
          testError = `Compilation failed: ${err.message}`;
          console.log(`    ❌ Compile failed: ${err.message}`);
        }
      } else {
        // Run mode: load pre-compiled script
        script = loadScript(tc.testCaseDir);
        console.log(
          `    📜 Using compiled script (${script.actions.length} actions)`,
        );
      }

      // ── Execute actions (skip for compile-only mode) ──
      if (script && testPassed && mode !== 'compile') {
        const stepsPromise = (async () => {
          for (let s = 0; s < script.actions.length; s++) {
            const action = script.actions[s];
            const stepLabel = action.instruction || `Step ${s + 1}`;
            console.log(`    🤖 Step ${s + 1}: "${stepLabel}"`);
            console.log(
              `       → ${action.action}: ${action.description || ''}`,
            );

            let actionResult = await executeAction(action, context);

            // Auto-recompile on failure: reinterpret via LLM and retry once
            if (!actionResult.success && mode !== 'run') {
              console.log(
                `    🔄 Step ${s + 1} failed — recompiling via LLM...`,
              );
              try {
                const newAction = await recompileStep(tc, s, interpretStep, {
                  currentUrl: page ? page.url() : baseUrl,
                });
                actionResult = await executeAction(newAction, context);
              } catch (retryErr) {
                throw new Error(`Retry failed: ${retryErr.message}`);
              }
            }

            if (!actionResult.success) {
              throw new Error(actionResult.error);
            }

            // Per-step screenshot (browser tests only)
            if (page && resultsDir) {
              const stepNum = String(s + 1).padStart(2, '0');
              try {
                await page.screenshot({
                  path: path.join(resultsDir, `step-${stepNum}.png`),
                  fullPage: true,
                });
              } catch {
                // Screenshot may fail
              }
            }

            stepResults.push({
              success: true,
              note: `${action.action}: ${action.description || ''}`,
            });
            console.log(`    ✅ Step ${s + 1}: done`);
          }
        })();

        try {
          await Promise.race([stepsPromise, timeoutPromise]);
        } catch (err) {
          stepResults.push({ success: false, error: err.message });
          testPassed = false;
          testError = err.message;
          console.log(`    ❌ Failed: ${err.message}`);
        } finally {
          clearTimeout(timeoutId);
        }
      } else {
        clearTimeout(timeoutId);
      }

      // Final screenshot
      if (page && resultsDir) {
        try {
          await page.screenshot({
            path: path.join(resultsDir, 'final.png'),
            fullPage: true,
          });
        } catch {
          // Screenshot may fail
        }
      }

      const duration = Date.now() - startTime;
      const result = {
        testName: tc.title,
        category: tc.category,
        caseName: tc.caseName,
        passed: testPassed,
        error: testError,
        duration,
        steps: stepResults,
        expectedResults: tc.expectedResults,
        resultsDir,
        sourceFile: path.relative(ROOT_DIR, file),
        timestamp: new Date().toISOString(),
      };

      if (resultsDir) {
        writeTestResult(resultsDir, tc, result);
      }
      moduleResults.push(result);
      allResults.push(result);

      const icon = testPassed ? '✅' : '❌';
      console.log(`  ${icon} ${tc.title} (${duration}ms)`);
    }

    // Module summary — in e2e/_results/timestamp/
    const summaryDir = createSummaryDir(e2eDir, timestamp);
    writeSummary(summaryDir, moduleName, moduleResults, { timestamp, port });
    const passed = moduleResults.filter(r => r.passed).length;
    console.log(
      `\n  📊 ${moduleName}: ${passed}/${moduleResults.length} passed`,
    );
  }

  if (browser) await closeBrowser(browser);

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
