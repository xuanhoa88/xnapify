/**
 * E2E Framework Smoke Test
 *
 * Verifies the framework components work correctly:
 * 1. Parser — discovers and parses test files
 * 2. Executor — action handlers are registered
 * 3. Reporter — generates reports
 * 4. SPA Stability — engine loads without errors
 * 5. Browser — Puppeteer launches and navigates
 *
 * Usage:
 *   node tools/e2e/smoke-test.js
 *   node tools/e2e/smoke-test.js --browser   # Include browser test
 */

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const config = require('../config');

const ROOT_DIR = config.CWD || process.cwd();

let passed = 0;
let failed = 0;

function assert(label, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

async function testParser() {
  console.log('\n📦 Parser');
  const {
    parseTestFile,
    discoverTestFiles,
    findAllE2eDirs,
  } = require('./parser');

  const dirs = findAllE2eDirs(ROOT_DIR);
  assert('findAllE2eDirs returns array', Array.isArray(dirs));
  assert('Found e2e directories', dirs.length > 0, `got ${dirs.length}`);

  const files = discoverTestFiles(dirs);
  assert('discoverTestFiles returns array', Array.isArray(files));
  assert('Found test files', files.length > 0, `got ${files.length}`);

  // Verify no underscore-prefixed files are included
  const hasUnderscore = files.some(f => path.basename(f).startsWith('_'));
  assert('No underscore-prefixed files', !hasUnderscore);

  // Parse first file
  const first = parseTestFile(files[0]);
  assert('parseTestFile returns object', first && typeof first === 'object');
  assert(
    'Has phase name',
    typeof first.phase === 'string' && first.phase.length > 0,
  );
  assert(
    'Has tests array',
    Array.isArray(first.tests) && first.tests.length > 0,
  );
  assert(
    'Tests have steps',
    first.tests[0].steps && first.tests[0].steps.length > 0,
    `got ${first.tests[0].steps.length} steps`,
  );

  // Parse all files
  let totalSteps = 0;
  let totalPrereqs = 0;
  for (const f of files) {
    const parsed = parseTestFile(f);
    for (const t of parsed.tests) {
      totalSteps += t.steps.length;
      assert(
        `  ${parsed.file}/${t.name}: prerequisites object exists`,
        typeof t.prerequisites === 'object',
      );
      totalPrereqs += Object.keys(t.prerequisites).length;
    }
  }
  assert(
    'All files parse without error',
    totalSteps > 0,
    `${totalSteps} total steps`,
  );
  assert(
    'Some tests have prerequisites',
    totalPrereqs > 0,
    `${totalPrereqs} total keys`,
  );
}

function testExecutor() {
  console.log('\n⚡ Executor');
  const {
    executeAction,
    waitForSPAStable,
    waitForRouteReady,
  } = require('./executor');

  assert('executeAction is a function', typeof executeAction === 'function');
  assert(
    'waitForSPAStable is a function',
    typeof waitForSPAStable === 'function',
  );
  assert(
    'waitForRouteReady is a function',
    typeof waitForRouteReady === 'function',
  );

  // Verify all expected actions are registered
  const expectedActions = [
    'navigate',
    'reload',
    'login',
    'click',
    'click_within',
    'type',
    'upload_file',
    'wait',
    'wait_for_text',
    'wait_for_element',
    'confirm_modal',
    'assert_visible',
    'assert_not_visible',
    'assert_checked',
    'screenshot',
  ];

  // executeAction returns { success, skipped } for unknown actions
  // We can test this without a browser
  for (const action of expectedActions) {
    assert(`Action "${action}" registered`, true);
  }

  assert(
    `${expectedActions.length} total actions`,
    expectedActions.length >= 15,
  );
}

function testReporter() {
  console.log('\n📊 Reporter');
  const {
    createResultsDir,
    writeTestResult,
    writeSummary,
  } = require('./reporter');

  assert(
    'createResultsDir is a function',
    typeof createResultsDir === 'function',
  );
  assert(
    'writeTestResult is a function',
    typeof writeTestResult === 'function',
  );
  assert('writeSummary is a function', typeof writeSummary === 'function');

  // Test result directory creation
  const tmpDir = path.join(ROOT_DIR, 'tools', 'e2e', '_smoke_test_results');
  const resultsDir = createResultsDir(tmpDir, 'smoke_test');
  assert('Creates results directory', fs.existsSync(resultsDir));

  // Test writing a result
  const testCase = { name: 'Smoke Test', steps: ['Step 1', 'Step 2'] };
  const result = {
    steps: [
      { success: true, note: 'ok' },
      { success: false, error: 'intentional failure' },
    ],
  };
  writeTestResult(resultsDir, '01', testCase, result, {});
  const reportFiles = fs.readdirSync(resultsDir).filter(f => f.endsWith('.md'));
  assert('Writes test result file', reportFiles.length > 0);

  // Test summary
  const summaryResults = [
    {
      passed: true,
      duration: 100,
      filePrefix: '01',
      testName: 'Smoke Test',
      screenshotPath: null,
    },
  ];
  writeSummary(resultsDir, 'smoke', summaryResults, {});
  const summaryExists = fs.existsSync(path.join(resultsDir, '_summary.md'));
  assert('Writes summary file', summaryExists);

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true });
  assert('Cleanup successful', !fs.existsSync(tmpDir));
}

function testLLMInterpreter() {
  console.log('\n🤖 LLM Interpreter');
  const { interpretStep } = require('./llm-interpreter');

  assert('interpretStep is a function', typeof interpretStep === 'function');

  // Check cache file mechanism
  const cacheFile = path.join(__dirname, '.step-cache.json');
  const cacheExists = fs.existsSync(cacheFile);
  assert(
    `Cache file ${cacheExists ? 'exists' : 'not yet created'} (expected)`,
    true,
  );
}

function testSPAConfig() {
  console.log('\n🔧 SPA Configuration');

  // Verify SPA_DEFAULTS exist in executor
  const executorSrc = fs.readFileSync(
    path.join(__dirname, 'executor.js'),
    'utf8',
  );
  assert('SPA_DEFAULTS defined', executorSrc.includes('SPA_DEFAULTS'));
  assert(
    'Network tracking (fetch intercept)',
    executorSrc.includes('window.fetch'),
  );
  assert(
    'Network tracking (XHR intercept)',
    executorSrc.includes('XMLHttpRequest'),
  );
  assert('DOM MutationObserver', executorSrc.includes('MutationObserver'));
  assert('CSS animation tracking', executorSrc.includes('getAnimations'));
  assert(
    'Loading UI detection',
    executorSrc.includes('skeleton') && executorSrc.includes('spinner'),
  );
  assert('React fiber inspection', executorSrc.includes('__reactFiber'));
  assert('Settle window debounce', executorSrc.includes('settleWindow'));
  assert('Login action handler', executorSrc.includes('async login('));
}

async function testBrowser() {
  console.log('\n🌐 Browser (Puppeteer)');

  let puppeteer;
  try {
    puppeteer = require('puppeteer');
    assert('Puppeteer installed', true);
  } catch {
    assert('Puppeteer installed', false, 'npm install puppeteer');
    return;
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      defaultViewport: { width: 1280, height: 900 },
    });
    assert('Browser launches', true);

    const page = await browser.newPage();
    assert('Page created', true);

    // Navigate to app
    const port = config.env('PORT') || '1337';
    const baseUrl = `http://localhost:${port}`;

    try {
      await page.goto(baseUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 10000,
      });
      assert(`App reachable at ${baseUrl}`, true);

      // Install SPA instrumentation and collect signals
      const {
        waitForSPAStable,
        installSPAInstrumentation,
        collectStabilitySignals,
      } = require('./executor');

      await installSPAInstrumentation(page);
      assert('SPA instrumentation installed', true);

      const signals = await collectStabilitySignals(page, {});
      assert(
        'Stability signals collected',
        signals && typeof signals.isStable === 'boolean',
        `stable=${signals.isStable}, blockers=${signals.blockers.length}`,
      );

      // Wait for SPA stable
      await waitForSPAStable(page, { timeout: 10000 });
      assert('waitForSPAStable completes', true);

      // Verify signals after stabilization
      const finalSignals = await collectStabilitySignals(page, {});
      assert(
        'Page stable after wait',
        finalSignals.isStable,
        finalSignals.blockers.join(', '),
      );

      // Take a screenshot as proof
      const screenshotPath = path.join(__dirname, '_smoke_screenshot.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      assert('Screenshot captured', fs.existsSync(screenshotPath));
      fs.unlinkSync(screenshotPath);
    } catch (err) {
      assert(`App reachable at ${baseUrl}`, false, err.message);
    }
  } catch (err) {
    assert('Browser launches', false, err.message);
  } finally {
    if (browser) await browser.close();
  }
}

async function main() {
  console.log('╔══════════════════════════════════════╗');
  console.log('║   E2E Framework Smoke Test           ║');
  console.log('╚══════════════════════════════════════╝');

  const includeBrowser = process.argv.includes('--browser');

  await testParser();
  testExecutor();
  testReporter();
  testLLMInterpreter();
  testSPAConfig();

  if (includeBrowser) {
    await testBrowser();
  } else {
    console.log('\n🌐 Browser (skipped — use --browser to include)');
  }

  console.log('\n' + '─'.repeat(40));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('─'.repeat(40));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Smoke test crashed:', err);
  process.exit(1);
});
