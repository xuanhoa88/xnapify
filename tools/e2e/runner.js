/* eslint-disable no-console */

//
// xnapify (https://github.com/xuanhoa88/xnapify/)
//
// This source code is licensed under the MIT license found in the
// LICENSE.txt file in the root directory of this source tree.
//

//
// E2E Test Runner
//
// Reads natural language .md test cases from each module's e2e/ folder,
// launches Chromium via Puppeteer, and executes them step by step.
//
// Usage (via npm scripts — loads .env via dotenv-flow):
//   npm run test:e2e                                     # Auto: compile if needed, run
//   npm run test:e2e:headed                              # Show browser window
//   npm run test:e2e -- --mode=compile                   # Compile scripts via LLM
//   npm run test:e2e -- --mode=run                       # Run from compiled scripts
//   npm run test:e2e -- --mode=compile --force           # Force recompile
//   npm run test:e2e -- extensions                       # Run extensions module
//   npm run test:e2e -- quick-access-plugin              # Run specific extension
//   npm run test:e2e -- --filter="**/login/**"           # Filter by glob pattern
//   npm run test:e2e -- --parallel                       # Run modules concurrently
//
// Environment:
//   XNAPIFY_PORT|E2E_PORT|PORT=1337      # App port (auto-detected from .env)
//   E2E_HEADLESS=false                   # Show browser (fallback; prefer --headed flag)
//   E2E_FIXTURE_ZIP=...                  # Path to test extension .zip
//   E2E_EMAIL=admin@...                  # Login email (fallback — prefer YAML front-matter)
//   E2E_PASSWORD=secret                  # Login password (fallback — prefer YAML front-matter)
//
// LLM Interpreter:
//   E2E_LLM_PROVIDER=auto  # auto (default) | stdin | openai | anthropic | google | ollama | custom
//   E2E_LLM_API_KEY=...    # Override auto-detected key
//   E2E_LLM_MODEL=...      # Model name (optional, has defaults)
//   E2E_LLM_BASE_URL=...   # Base URL (for custom LLM provider)
//

// Guard: must be launched via tools/tasks/e2e.js (npm run test:e2e)
// Direct CLI invocation skips dotenv-flow config loading.
if (!process.env.E2E_VIA_TASK) {
  console.error('');
  console.error('❌ Direct execution is not supported.');
  console.error('   Use npm scripts to ensure .env config is loaded:');
  console.error('');
  console.error('   npm run test:e2e                    # auto mode');
  console.error('   npm run test:e2e:headed             # visible browser');
  console.error('   npm run test:e2e -- --mode=compile   # compile only');
  console.error('   npm run test:e2e -- --parallel       # parallel modules');
  console.error('');
  process.exit(1);
}

// Global safety net for Puppeteer WebSocket disconnected events
process.on('unhandledRejection', reason => {
  if (reason && reason.message && reason.message.includes('socket hang up')) {
    console.error('   ⚠ Browser connection lost — continuing...');
    return;
  }
  console.error('Fatal error:', reason);
  process.exit(1);
});

const fs = require('fs');
const http = require('http');
const path = require('path');

const { launchBrowser, createPage, closeBrowser } = require('./browser');
const {
  needsCompile,
  loadScript,
  compileTestCase,
  recompileStep,
} = require('./compiler');
const { executeAction, createAPIState } = require('./executor');
const { interpretStep, LLM_PROVIDERS } = require('./llmInterpreter');
const {
  parseTestFile,
  discoverTestFiles,
  findAllE2eDirs,
  detectTestType,
  SOURCE_BASES,
} = require('./parser');
const {
  createReportDir,
  writeTestResult,
  writeSummary,
} = require('./reporter');

const ROOT_DIR = process.env.CWD || process.cwd();

const TYPE_ICONS = { ui: '🌐', api: '🔌', system: '🔗' };

// ── Config ────────────────────────────────────────────────────────

function resolvePort() {
  // dotenv-flow is pre-loaded by tools/run.js → process.env has all .env values
  return (
    process.env.XNAPIFY_PORT ||
    process.env.E2E_PORT ||
    process.env.PORT ||
    '1337'
  );
}

function getModuleName(rootDir, e2eDir) {
  for (const base of SOURCE_BASES) {
    const rel = path.relative(path.join(rootDir, base), path.dirname(e2eDir));
    if (!rel.startsWith('..') && !path.isAbsolute(rel)) return rel;
  }
  return null;
}

function findMatchingE2eDir(allE2eDirs, rootDir, arg) {
  for (const dir of allE2eDirs) {
    const modName = getModuleName(rootDir, dir);
    if (!modName) continue;
    if (arg === modName || arg.startsWith(modName + '/')) {
      const subPath = arg === modName ? '' : arg.slice(modName.length + 1);
      return { e2eDir: dir, subPath };
    }
  }
  return null;
}

function resolveSubPath(e2eDir, subPath) {
  const fullPath = path.join(e2eDir, subPath);

  const testFile = path.join(fullPath, 'test.md');
  if (fs.existsSync(testFile)) {
    return { dir: e2eDir, files: [testFile] };
  }

  if (fs.existsSync(fullPath)) {
    const files = discoverTestFiles([fullPath]);
    if (files.length === 0) {
      console.error(`❌ No test cases found in: ${subPath}`);
      process.exit(1);
    }
    return { dir: e2eDir, files };
  }

  console.error(`❌ Path not found: ${subPath}`);
  console.error(`   Searched: ${fullPath}`);
  process.exit(1);
}

async function resolveTarget(arg) {
  const allE2eDirs = await findAllE2eDirs(ROOT_DIR);
  if (!arg) return allE2eDirs;

  const match = findMatchingE2eDir(allE2eDirs, ROOT_DIR, arg);
  if (!match) {
    console.error(`❌ No e2e/ directory found matching: ${arg}`);
    console.error(
      `   Make sure the module exists in src/apps or src/extensions.`,
    );
    process.exit(1);
  }

  const { e2eDir, subPath } = match;
  if (!subPath) return [e2eDir];

  return [resolveSubPath(e2eDir, subPath)];
}

// Match a file path against a glob-like filter pattern.
// Supports: * (any segment chars), ** (any path depth), ? (single char).
// No external dependency — converts to regex internally.
//
// @param {string} filePath  Relative file path (forward slashes)
// @param {string} pattern   Glob pattern (e.g. "**/login/**", "**/api/**")
// @returns {boolean}
function matchesFilter(filePath, pattern) {
  // Normalize to forward slashes
  const normalized = filePath.replace(/\\/g, '/');
  const pat = pattern.replace(/\\/g, '/');

  // Convert glob to regex
  let regex = pat
    .replace(/[.+^${}()|[\]]/g, '\\$&') // Escape regex specials (except * and ?)
    .replace(/\*\*/g, '\0') // Temp placeholder for **
    .replace(/\*/g, '[^/]*') // * = any chars except /
    .replace(/\?/g, '[^/]') // ? = single char except /
    .replace(/\0/g, '.*'); // ** = any chars including /

  // Allow partial matching: pattern doesn't need to cover the full path
  // e.g., "**/login/**" matches "src/extensions/foo/e2e/login/01-test/test.md"
  return new RegExp(regex).test(normalized);
}

/**
 * Wait for the application to be reachable at the given URL.
 * Pings the URL until it returns a response or times out.
 */
async function waitForAppReady(url, timeoutMs = 30000) {
  const start = Date.now();
  const interval = 2000;

  process.stdout.write(`  ⏳ Waiting for app to be ready at ${url}...`);

  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: 2000 }, res => {
          res.on('data', () => {}); // consume data
          res.on('end', () => resolve());
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('timeout'));
        });
      });
      console.log(' ✅ Ready!');
      return true;
    } catch (err) {
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, interval));
    }
  }

  console.log('\n');
  console.error(`❌ App not reachable at ${url} after ${timeoutMs / 1000}s`);
  console.error('   Ensure the development server is running (npm run dev).');
  process.exit(1);
}

// ── Main ──────────────────────────────────────────────────────────

async function run() {
  const args = process.argv.slice(2);
  const headed = args.includes('--headed');
  const force = args.includes('--force');
  const parallel = args.includes('--parallel');
  const modeArg = args.find(a => a.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'auto'; // compile | run | auto
  const filterArg = args.find(a => a.startsWith('--filter='));
  const filterPattern = filterArg ? filterArg.split('=')[1] : null;
  const targetArg = args.find(a => !a.startsWith('--'));
  const port = resolvePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const startupTimeout = parseInt(
    process.env.E2E_STARTUP_TIMEOUT || '30000',
    10,
  );
  const headless = headed ? false : process.env.E2E_HEADLESS !== 'false';
  const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '_');

  const llmProvider = process.env.E2E_LLM_PROVIDER || 'auto';

  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║         E2E Test Runner              ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`  Port:     ${port}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Mode:     ${mode}${force ? ' (force)' : ''}`);
  console.log(`  Headless: ${headless}`);
  console.log(`  Parallel: ${parallel}`);
  console.log(`  Target:   ${targetArg || 'all'}`);
  if (filterPattern) {
    console.log(`  Filter:   ${filterPattern}`);
  }
  console.log(`  LLM:      ${llmProvider}`);
  if (llmProvider === 'auto') {
    console.log(
      '  Note:     Auto-detecting LLM from env (E2E_GEMINI_API_KEY, E2E_OPENAI_API_KEY, etc.)',
    );
  }
  console.log('');

  // ── Pre-flight check: App Reachability ──
  if (mode !== 'compile') {
    await waitForAppReady(baseUrl, startupTimeout);
  }

  // ── Deferred LLM validation ──
  // Only validate when compilation is actually needed (not upfront).
  let resolvedLLM = llmProvider;
  let llmValidated = false;

  async function ensureLLMAvailable() {
    if (llmValidated || mode === 'run') return;

    if (llmProvider === 'auto') {
      const hasGemini = process.env.E2E_GEMINI_API_KEY;
      const hasOpenAI = process.env.E2E_OPENAI_API_KEY;
      const hasAnthropic = process.env.E2E_ANTHROPIC_API_KEY;
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
        LLM_PROVIDERS.ollama.baseUrl || 'http://localhost:11434';
      try {
        await new Promise((resolve, reject) => {
          // LLM baseUrl has /v1 appended, we need the root domain for /api/tags
          const rootUrl = new URL(ollamaUrl).origin;

          const req = http.request(
            `${rootUrl}/api/tags`,
            { method: 'GET', timeout: 5000 },
            res => {
              res.resume();
              if (res.statusCode === 200) {
                resolve();
              } else {
                reject(new Error(`Ollama returned status ${res.statusCode}`));
              }
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
          '     Or set E2E_GEMINI_API_KEY, E2E_OPENAI_API_KEY, or E2E_ANTHROPIC_API_KEY',
        );
        process.exit(1);
      }
    }
    llmValidated = true;
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
  const targetDirs = await resolveTarget(targetArg);
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

  // ── Apply --filter glob ──
  if (filterPattern) {
    const before = testFiles.length;
    testFiles = testFiles.filter(t => {
      const rel = path.relative(ROOT_DIR, t.file);
      return matchesFilter(rel, filterPattern);
    });
    if (testFiles.length === 0) {
      console.log(`No test files match filter: ${filterPattern}`);
      console.log(`  (${before} files were found before filtering)`);
      return;
    }
    console.log(
      `🔍 Filter matched ${testFiles.length}/${before} test file(s):`,
    );
  } else {
    console.log(`📋 Found ${testFiles.length} test file(s):`);
  }
  testFiles.forEach(t => console.log(`   ${path.relative(ROOT_DIR, t.file)}`));
  console.log('');

  // Deferred browser launching: We MUST wait until AFTER LLM compilation.
  // Slow local LLMs (Ollama) can take 5+ minutes to compile a test case.
  // If we launch Chromium upfront, the idle WebSocket connection will drop with ECONNRESET.

  // Group files by e2e directory (module)
  const byModule = new Map();
  for (const t of testFiles) {
    if (!byModule.has(t.e2eDir)) byModule.set(t.e2eDir, []);
    byModule.get(t.e2eDir).push(t.file);
  }

  // ── Per-module execution function ──
  // Extracted so it can be called sequentially or in parallel.
  // In parallel mode, each module gets its own browser instance.
  async function runModule(e2eDir, files, sharedBrowser) {
    const moduleName = path.basename(path.dirname(e2eDir));
    let browser = sharedBrowser;
    const moduleResults = [];

    console.log(`\n━━━ Module: ${moduleName} ━━━`);

    for (const file of files) {
      const tc = parseTestFile(file);
      const resultsDir =
        mode !== 'compile' ? createReportDir(tc.testCaseDir, timestamp) : null;
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

      const TEST_TIMEOUT = 600000; // 10 minutes per test case
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
          // Prevent ECONNRESET during slow LLM compilations by closing any idle browser
          if (browser) {
            console.log(
              '    ⏳ Closing browser during compilation to prevent idle timeout...',
            );
            await closeBrowser(browser);
            browser = null; // Will be lazily re-launched
          }

          script = await compileTestCase(
            tc,
            interpretStep,
            { currentUrl: baseUrl },
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
      let testPage = null;
      let needsBrowser = false;

      if (script && testPassed && mode !== 'compile') {
        // Lazy launch the browser ONLY exactly when we are ready to execute UI tests.
        const type = detectTestType(tc.testCaseDir);
        needsBrowser = type === 'ui' || type === 'system';

        if (needsBrowser && !browser) {
          browser = await launchBrowser({ headless });
        }

        // Get a fresh page for each test to ensure cookie and state isolation
        if (needsBrowser && browser) {
          testPage = await createPage(browser);
        }

        const context = {
          page: testPage,
          apiState: createAPIState(tc.prerequisites),
          baseUrl,
          currentCard: null,
          prerequisites: tc.prerequisites || {},
          fixtureZip:
            (tc.prerequisites || {}).fixture_zip || process.env.E2E_FIXTURE_ZIP,
        };

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
                  currentUrl: testPage ? testPage.url() : baseUrl,
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
            if (testPage && resultsDir) {
              const stepNum = String(s + 1).padStart(2, '0');
              try {
                await testPage.screenshot({
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
      if (testPage && resultsDir) {
        try {
          await testPage.screenshot({
            path: path.join(resultsDir, 'final.png'),
            fullPage: true,
          });
        } catch {
          // Screenshot may fail
        }
      }

      if (needsBrowser && browser && testPage) {
        try {
          const ctx = testPage.browserContext();
          await testPage.close();
          await ctx.close();
        } catch {
          // Page already closed or crashed
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

      const icon = testPassed ? '✅' : '❌';
      console.log(`  ${icon} ${tc.title} (${duration}ms)`);
    }

    // Module summary
    const summaryDir = createReportDir(e2eDir, timestamp);
    writeSummary(summaryDir, moduleName, moduleResults, { timestamp, port });
    const passed = moduleResults.filter(r => r.passed).length;
    console.log(
      `\n  📊 ${moduleName}: ${passed}/${moduleResults.length} passed`,
    );

    return { browser, results: moduleResults };
  }

  // ── Execute modules ──
  const allResults = [];

  if (parallel && byModule.size > 1) {
    // Parallel mode: each module gets its own browser instance
    console.log(`⚡ Running ${byModule.size} modules in parallel...`);

    const modulePromises = Array.from(byModule.entries()).map(
      ([e2eDir, files]) =>
        runModule(e2eDir, files, null).then(async ({ browser: b, results }) => {
          if (b) await closeBrowser(b);
          return results;
        }),
    );

    const moduleOutputs = await Promise.all(modulePromises);
    for (const results of moduleOutputs) {
      allResults.push(...results);
    }
  } else {
    // Sequential mode: shared browser across modules
    let browser = null;

    for (const [e2eDir, files] of byModule) {
      const output = await runModule(e2eDir, files, browser);
      browser = output.browser;
      allResults.push(...output.results);
    }

    if (browser) await closeBrowser(browser);
  }

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

module.exports = { run };
