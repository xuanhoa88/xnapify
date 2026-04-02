/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * E2E Test Runner — Reporter
 *
 * Creates result files and summary reports for each test run.
 *
 * Results are grouped by test case and execution time:
 *
 *   e2e/
 *     {category}/
 *       {NN-name}/
 *         test.md                   ← test case definition
 *         script.json               ← compiled automation actions
 *         results/
 *           {timestamp}/            ← grouped by execution time
 *             result.md             ← structured test result
 *             step-01.png           ← per-step screenshots
 *             step-02.png
 *             final.png             ← final state screenshot
 *
 * Evidence files (.png, .webp, .mp4, etc.) are auto-discovered
 * and listed in the Evidence section of result.md.
 */

const fs = require('fs');
const path = require('path');

/**
 * Create a timestamped results directory for a specific test case.
 *
 * @param {string} testCaseDir  The test case directory (e.g., e2e/login/01-buttons-visible)
 * @param {string} timestamp    Run timestamp
 * @returns {string} Absolute path to the results directory
 */
function createTestCaseResultsDir(testCaseDir, timestamp) {
  const resultsDir = path.join(testCaseDir, 'results', timestamp);
  fs.mkdirSync(resultsDir, { recursive: true });
  return resultsDir;
}

/**
 * Create a module-level summary directory for a run.
 *
 * @param {string} e2eDir     The module's e2e/ directory
 * @param {string} timestamp  Run timestamp
 * @returns {string} Absolute path to the summary directory
 */
function createSummaryDir(e2eDir, timestamp) {
  const summaryDir = path.join(e2eDir, '_results', timestamp);
  fs.mkdirSync(summaryDir, { recursive: true });
  return summaryDir;
}

function writeTestResult(resultsDir, testCase, result) {
  const filePath = path.join(resultsDir, 'result.md');

  const stepsText = result.steps
    .map((s, i) => {
      const icon = s.success ? '✅' : s.skipped ? '⏭️' : '❌';
      const detail = s.error ? ` — ${s.error}` : s.note ? ` — ${s.note}` : '';
      return `${i + 1}. ${icon} ${testCase.steps[i] || '(not executed)'}${detail}`;
    })
    .join('\n');

  const expectedText =
    (result.expectedResults || []).length > 0
      ? (result.expectedResults || []).map(e => `- ${e}`).join('\n')
      : 'No expected results defined.';

  // Auto-discover all evidence files (screenshots, videos)
  const mediaExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm'];
  let evidenceText = '';
  try {
    const files = fs
      .readdirSync(resultsDir)
      .filter(f => {
        const ext = path.extname(f).toLowerCase();
        return mediaExts.includes(ext);
      })
      .sort();

    if (files.length > 0) {
      const screenshots = files.filter(f =>
        /\.(png|jpg|jpeg|webp|gif)$/i.test(f),
      );
      const videos = files.filter(f => /\.(mp4|webm)$/i.test(f));

      if (screenshots.length > 0) {
        evidenceText += '### Screenshots\n\n';
        evidenceText += screenshots.map(f => `- [${f}](./${f})`).join('\n');
      }
      if (videos.length > 0) {
        evidenceText +=
          (screenshots.length > 0 ? '\n\n' : '') + '### Videos\n\n';
        evidenceText += videos.map(f => `- [${f}](./${f})`).join('\n');
      }
    } else {
      evidenceText = 'No evidence captured.';
    }
  } catch {
    evidenceText = 'No evidence captured.';
  }

  const typeIcons = { ui: '🌐 UI', api: '🔌 API', system: '🔗 System' };
  const typeLabel = typeIcons[testCase.testType] || '🌐 UI';

  const content = `# ${testCase.title}

**Source:** ${result.sourceFile}
**Type:** ${typeLabel}
**Date:** ${result.timestamp}
**Result:** ${result.passed ? '✅ PASS' : '❌ FAIL'}
**Duration:** ${result.duration}ms

## Steps Executed

${stepsText}

## Expected Results

${expectedText}

## Notes

${result.error || 'All steps completed successfully.'}

## Evidence

${evidenceText}
`;

  fs.writeFileSync(filePath, content);
  return { filePath };
}

function writeSummary(summaryDir, moduleName, results, config) {
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  const rowsText = results
    .map((r, i) => {
      const icon = r.passed ? '✅ PASS' : '❌ FAIL';
      const resultLink = `[result](../../${r.category}/${r.caseName}/results/${config.timestamp}/result.md)`;
      return `| ${i + 1} | ${r.category}/${r.caseName} | ${r.testName} | ${icon} | ${resultLink} |`;
    })
    .join('\n');

  const failedSection = results
    .filter(r => !r.passed)
    .map(
      r =>
        `### ${r.category}/${r.caseName}: ${r.testName}\n- **Error:** ${r.error}\n- **Result:** [result](../../${r.category}/${r.caseName}/results/${config.timestamp}/result.md)`,
    )
    .join('\n\n');

  const content = `# E2E Test Results: ${moduleName}

**Date:** ${config.timestamp}
**Port:** ${config.port}
**Total:** ${passed}/${total} passed
**Duration:** ${totalDuration}ms

## Results

| # | Test Case | Title | Result | Details |
|---|-----------|-------|--------|---------|
${rowsText}
${failedSection ? `\n## Failed Tests\n\n${failedSection}` : ''}
`;

  const summaryPath = path.join(summaryDir, '_summary.md');
  fs.writeFileSync(summaryPath, content);
  return summaryPath;
}

module.exports = {
  createTestCaseResultsDir,
  createSummaryDir,
  writeTestResult,
  writeSummary,
};
