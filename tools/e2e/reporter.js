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
 */

const fs = require('fs');
const path = require('path');

function createResultsDir(e2eDir, timestamp) {
  const resultsDir = path.join(e2eDir, 'results', timestamp);
  fs.mkdirSync(resultsDir, { recursive: true });
  return resultsDir;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
}

function writeTestResult(resultsDir, filePrefix, testCase, result) {
  const slug = `${filePrefix}_${slugify(testCase.name)}`;
  const filePath = path.join(resultsDir, `${slug}.md`);

  const stepsText = result.steps
    .map((s, i) => {
      const icon = s.success ? '✅' : s.skipped ? '⏭️' : '❌';
      const note = s.error ? ` — ${s.error}` : s.note || '';
      return `${i + 1}. ${icon} ${testCase.steps[i] || '(not executed)'}${note}`;
    })
    .join('\n');

  const content = `# ${testCase.name}

**Source:** ${result.sourceFile}
**Date:** ${result.timestamp}
**Result:** ${result.passed ? '✅ PASS' : '❌ FAIL'}
**Duration:** ${result.duration}ms

## Steps Executed

${stepsText}

## Notes

${result.error || 'All steps completed successfully.'}

## Evidence

${result.screenshotPath ? `- Screenshot: [${path.basename(result.screenshotPath)}](./${path.basename(result.screenshotPath)})` : '- No screenshot captured'}
`;

  fs.writeFileSync(filePath, content);
  return { slug, filePath };
}

function writeSummary(resultsDir, moduleName, results, config) {
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const totalDuration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

  const rowsText = results
    .map((r, i) => {
      const icon = r.passed ? '✅ PASS' : '❌ FAIL';
      const evidence = r.screenshotPath
        ? `[screenshot](./${path.basename(r.screenshotPath)})`
        : '-';
      return `| ${i + 1} | ${r.filePrefix} | ${r.testName} | ${icon} | ${evidence} |`;
    })
    .join('\n');

  const failedSection = results
    .filter(r => !r.passed)
    .map(
      r =>
        `### ${r.filePrefix}: ${r.testName}\n- **Error:** ${r.error}\n- **Evidence:** ${r.screenshotPath ? `[screenshot](./${path.basename(r.screenshotPath)})` : 'none'}`,
    )
    .join('\n\n');

  const content = `# E2E Test Results: ${moduleName}

**Date:** ${config.timestamp}
**Port:** ${config.port}
**Total:** ${passed}/${total} passed
**Duration:** ${totalDuration}ms

## Results

| # | File | Test Case | Result | Evidence |
|---|------|-----------|--------|----------|
${rowsText}
${failedSection ? `\n## Failed Tests\n\n${failedSection}` : ''}
`;

  const summaryPath = path.join(resultsDir, '_summary.md');
  fs.writeFileSync(summaryPath, content);
  return summaryPath;
}

module.exports = { createResultsDir, writeTestResult, writeSummary, slugify };
