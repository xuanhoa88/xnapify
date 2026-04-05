#!/usr/bin/env node
/**
 * i18n Checker - Detects hardcoded strings and missing translations.
 * Scans for untranslated text in JSX/JS files.
 *
 * Usage: node i18nCheck.js [project-path]
 */

const fs = require('fs');
const path = require('path');
const { SKIP_DIRS, VIEW_EXTENSIONS, walkFiles } = require('../../scripts/constants');

// Patterns that indicate hardcoded strings (should be translated)
const HARDCODED_PATTERNS = [
  // Text directly in JSX: <div>Hello World</div>
  />\s*[A-Z][a-zA-Z\s]{3,30}\s*<\//g,
  // JSX attribute strings: title="Welcome"
  /(title|placeholder|label|alt|aria-label)="[A-Z][a-zA-Z\s]{2,}"/g,
  // Button/heading text
  /<(button|h[1-6]|p|span|label)[^>]*>\s*[A-Z][a-zA-Z\s!?.,]{3,}\s*<\//g,
];

// Patterns that indicate proper i18n usage
const I18N_PATTERNS = [
  /t\(['"]/, // t('key') - react-i18next
  /useTranslation/, // React hook
  /\$t\(/, // Vue i18n
  /FormattedMessage/, // react-intl
  /i18n\./, // Generic i18n
];

function flattenKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const sub of flattenKeys(v, newKey)) keys.add(sub);
    } else {
      keys.add(newKey);
    }
  }
  return keys;
}

function findLocaleFiles(projectPath) {
  const patterns = ['translations', 'locales', 'lang', 'i18n', 'messages'];
  const results = [];

  function search(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) search(fullPath);
      } else if (entry.name.endsWith('.json')) {
        const parentName = path.basename(dir);
        if (
          patterns.includes(parentName) ||
          patterns.some(p => fullPath.includes(`/${p}/`))
        ) {
          results.push(fullPath);
        }
      }
    }
  }

  search(projectPath);
  return results;
}

function checkLocaleCompleteness(localeFiles) {
  const issues = [];
  const passed = [];

  if (localeFiles.length === 0) {
    return { passed: [], issues: ['[!] No locale files found'] };
  }

  const locales = {};
  for (const filePath of localeFiles) {
    try {
      const lang = path.basename(path.dirname(filePath));
      const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!locales[lang]) locales[lang] = {};
      locales[lang][path.basename(filePath, '.json')] = flattenKeys(content);
    } catch {
      continue;
    }
  }

  const langs = Object.keys(locales);
  if (langs.length < 2) {
    passed.push(`[OK] Found ${localeFiles.length} locale file(s)`);
    return { passed, issues };
  }

  passed.push(`[OK] Found ${langs.length} language(s): ${langs.join(', ')}`);

  const baseLang = langs[0];
  for (const namespace of Object.keys(locales[baseLang] || {})) {
    const baseKeys = locales[baseLang][namespace] || new Set();

    for (const lang of langs.slice(1)) {
      const otherKeys = (locales[lang] || {})[namespace] || new Set();

      const missing = [...baseKeys].filter(k => !otherKeys.has(k));
      if (missing.length > 0) {
        issues.push(`[X] ${lang}/${namespace}: Missing ${missing.length} keys`);
      }

      const extra = [...otherKeys].filter(k => !baseKeys.has(k));
      if (extra.length > 0) {
        issues.push(`[!] ${lang}/${namespace}: ${extra.length} extra keys`);
      }
    }
  }

  if (issues.length === 0) passed.push('[OK] All locales have matching keys');
  return { passed, issues };
}

function checkHardcodedStrings(projectPath) {
  const issues = [];
  const passed = [];

  const codeFiles = walkFiles(projectPath, VIEW_EXTENSIONS).filter(
    f => !f.includes('test') && !f.includes('spec'),
  );

  if (codeFiles.length === 0) {
    return { passed: ['[!] No code files found'], issues: [] };
  }

  let filesWithI18n = 0;
  let filesWithHardcoded = 0;
  const examples = [];

  for (const filePath of codeFiles.slice(0, 50)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const hasI18n = I18N_PATTERNS.some(p => p.test(content));
      if (hasI18n) filesWithI18n++;

      let hardcodedFound = false;
      for (const pattern of HARDCODED_PATTERNS) {
        pattern.lastIndex = 0;
        const matches = content.match(pattern);
        if (matches && !hasI18n) {
          hardcodedFound = true;
          if (examples.length < 5) {
            examples.push(
              `${path.basename(filePath)}: ${matches[0].slice(0, 40)}...`,
            );
          }
        }
      }
      if (hardcodedFound) filesWithHardcoded++;
    } catch {
      continue;
    }
  }

  passed.push(`[OK] Analyzed ${codeFiles.length} code files`);
  if (filesWithI18n > 0) passed.push(`[OK] ${filesWithI18n} files use i18n`);

  if (filesWithHardcoded > 0) {
    issues.push(`[X] ${filesWithHardcoded} files may have hardcoded strings`);
    for (const ex of examples) issues.push(`   → ${ex}`);
  } else {
    passed.push('[OK] No obvious hardcoded strings detected');
  }

  return { passed, issues };
}

function main() {
  const target = process.argv[2] || '.';
  const projectPath = path.resolve(target);

  console.log('\n' + '='.repeat(60));
  console.log('  i18n CHECKER - Internationalization Audit');
  console.log('='.repeat(60) + '\n');

  const localeFiles = findLocaleFiles(projectPath);
  const localeResult = checkLocaleCompleteness(localeFiles);
  const codeResult = checkHardcodedStrings(projectPath);

  console.log('[LOCALE FILES]');
  console.log('-'.repeat(40));
  for (const item of localeResult.passed) console.log(`  ${item}`);
  for (const item of localeResult.issues) console.log(`  ${item}`);

  console.log('\n[CODE ANALYSIS]');
  console.log('-'.repeat(40));
  for (const item of codeResult.passed) console.log(`  ${item}`);
  for (const item of codeResult.issues) console.log(`  ${item}`);

  const criticalIssues = [...localeResult.issues, ...codeResult.issues].filter(
    i => i.startsWith('[X]'),
  ).length;

  console.log('\n' + '='.repeat(60));
  if (criticalIssues === 0) {
    console.log('[OK] i18n CHECK: PASSED');
    process.exit(0);
  } else {
    console.log(`[X] i18n CHECK: ${criticalIssues} issues found`);
    process.exit(1);
  }
}

main();
