#!/usr/bin/env node
/**
 * Accessibility Checker - WCAG compliance audit
 * Checks HTML/JSX/TSX files for accessibility issues.
 *
 * Usage: node a11yCheck.js <project-path>
 *
 * Checks:
 *   - Form labels
 *   - ARIA attributes
 *   - Keyboard navigation
 *   - Semantic HTML
 *   - Tab index misuse
 *   - Autoplay media
 */

const fs = require('fs');
const path = require('path');
const { VIEW_EXTENSIONS, walkFiles } = require('../../scripts/constants');

function findHtmlFiles(projectPath, limit = 50) {
  return walkFiles(projectPath, VIEW_EXTENSIONS, { limit });
}

function checkAccessibility(filePath) {
  const issues = [];

  let content;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return issues;
  }

  // Check for form inputs without labels
  const inputs = content.match(/<input[^>]*>/gi) || [];
  for (const inp of inputs) {
    if (!/type="hidden"/i.test(inp)) {
      if (!/aria-label/i.test(inp) && !/id=/i.test(inp)) {
        issues.push('Input without label or aria-label');
        break;
      }
    }
  }

  // Check for buttons without accessible text
  const buttons = content.match(/<button[^>]*>[^<]*<\/button>/gi) || [];
  for (const btn of buttons) {
    if (!/aria-label/i.test(btn)) {
      const text = btn.replace(/<[^>]+>/g, '').trim();
      if (!text) {
        issues.push('Button without accessible text');
        break;
      }
    }
  }

  // Check for missing lang attribute
  if (/<html/i.test(content) && !/lang=/i.test(content)) {
    issues.push('Missing lang attribute on <html>');
  }

  // Check for missing skip link
  if (/<main/i.test(content) || /<body/i.test(content)) {
    if (!/skip/i.test(content) && !/#main/i.test(content)) {
      issues.push('Consider adding skip-to-main-content link');
    }
  }

  // Check for click handlers without keyboard support
  const onclickCount = (content.toLowerCase().match(/onclick=/g) || []).length;
  const onkeyCount = (content.toLowerCase().match(/onkeydown=|onkeyup=/g) || [])
    .length;
  if (onclickCount > 0 && onkeyCount === 0) {
    issues.push('onClick without keyboard handler (onKeyDown)');
  }

  // Check for tabIndex misuse
  if (/tabindex=/i.test(content)) {
    const positiveTabIndex = content.match(/tabindex="([1-9]\d*)"/gi);
    if (positiveTabIndex) {
      issues.push('Avoid positive tabIndex values');
    }
  }

  // Check for autoplay media
  if (/autoplay/i.test(content) && !/muted/i.test(content)) {
    issues.push('Autoplay media should be muted');
  }

  // Check for role usage without tabindex
  if (/role="button"/i.test(content)) {
    const divButtons = content.match(/<div[^>]*role="button"[^>]*>/gi) || [];
    for (const div of divButtons) {
      if (!/tabindex/i.test(div)) {
        issues.push("role='button' without tabindex");
        break;
      }
    }
  }

  return issues;
}

function main() {
  const projectPath = path.resolve(process.argv[2] || '.');

  console.log('\n' + '='.repeat(60));
  console.log('[ACCESSIBILITY CHECKER] WCAG Compliance Audit');
  console.log('='.repeat(60));
  console.log(`Project: ${projectPath}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('-'.repeat(60));

  const files = findHtmlFiles(projectPath);
  console.log(`Found ${files.length} HTML/JSX/TSX files`);

  if (files.length === 0) {
    const output = {
      script: 'a11yCheck',
      project: projectPath,
      files_checked: 0,
      issues_found: 0,
      passed: true,
      message: 'No HTML files found',
    };
    console.log(JSON.stringify(output, null, 2));
    process.exit(0);
  }

  const allIssues = [];
  for (const f of files) {
    const issues = checkAccessibility(f);
    if (issues.length > 0) {
      allIssues.push({ file: path.basename(f), issues });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('ACCESSIBILITY ISSUES');
  console.log('='.repeat(60));

  if (allIssues.length > 0) {
    for (const item of allIssues.slice(0, 10)) {
      console.log(`\n${item.file}:`);
      for (const issue of item.issues) console.log(`  - ${issue}`);
    }
    if (allIssues.length > 10) {
      console.log(`\n... and ${allIssues.length - 10} more files with issues`);
    }
  } else {
    console.log('No accessibility issues found!');
  }

  const totalIssues = allIssues.reduce(
    (sum, item) => sum + item.issues.length,
    0,
  );
  const passed = totalIssues < 5;

  const output = {
    script: 'a11yCheck',
    project: projectPath,
    files_checked: files.length,
    files_with_issues: allIssues.length,
    issues_found: totalIssues,
    passed,
  };

  console.log('\n' + JSON.stringify(output, null, 2));
  process.exit(passed ? 0 : 1);
}

main();
