#!/usr/bin/env node

/**
 * xnapify Secret Scanner — Pre-commit hook
 *
 * Scans staged files for hardcoded secrets, API keys, tokens, and credentials.
 * Designed for zero false-negatives on high-confidence patterns and low false
 * positives via entropy analysis on ambiguous matches.
 *
 * Usage:
 *   node tools/git/secretScanner.js          # Scan staged files (default)
 *   node tools/git/secretScanner.js --all    # Scan entire working tree
 *   node tools/git/secretScanner.js --fix    # Show remediation hints
 *
 * Exit codes:
 *   0 — No secrets found
 *   1 — Secrets detected (blocks commit)
 *   2 — Scanner error (does NOT block commit)
 */

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * High-confidence patterns — always flag these.
 * Each entry: { id, label, regex, severity }
 */
const SECRET_PATTERNS = [
  // AWS
  {
    id: 'aws-access-key',
    label: 'AWS Access Key ID',
    regex: /(?:^|['"=:\s])(?:AKIA[0-9A-Z]{16})(?:$|['";\s])/,
    severity: 'CRITICAL',
  },
  {
    id: 'aws-secret-key',
    label: 'AWS Secret Access Key',
    regex:
      /(?:aws_secret_access_key|aws_secret)\s*[=:]\s*['"]?([A-Za-z0-9/+=]{40})['"]?/i,
    severity: 'CRITICAL',
  },

  // Generic API keys / tokens with assignment context
  {
    id: 'generic-api-key',
    label: 'Hardcoded API Key',
    regex:
      /(?:api_key|apikey|api[-_]?secret)\s*[=:]\s*['"]([A-Za-z0-9_-]{20,})['"](?!\s*(?:process\.env|getenv|os\.environ))/i,
    severity: 'CRITICAL',
  },
  {
    id: 'generic-secret',
    label: 'Hardcoded Secret',
    regex:
      /(?:secret|secret_key|client_secret)\s*[=:]\s*['"]([A-Za-z0-9_-]{16,})['"](?!\s*(?:process\.env|getenv|os\.environ))/i,
    severity: 'CRITICAL',
  },
  {
    id: 'generic-password',
    label: 'Hardcoded Password',
    regex:
      /(?:password|passwd|pwd)\s*[=:]\s*['"](?!.*\{\{)(?!password|changeme|example|test|TODO|xxx|placeholder)(?!.*\b(?:is\s+incorrect|is\s+invalid|is\s+required|is\s+wrong|must\s+be|cannot\s+be|should\s+be)\b)([^'"]{8,})['"](?!\s*(?:process\.env|getenv|os\.environ))/i,
    severity: 'HIGH',
  },

  // Private keys
  {
    id: 'private-key',
    label: 'Private Key',
    regex:
      /-----BEGIN\s+(?:RSA|DSA|EC|OPENSSH|PGP)\s+PRIVATE\s+KEY(?:\s+BLOCK)?-----/,
    severity: 'CRITICAL',
  },

  // GitHub / GitLab tokens
  {
    id: 'github-token',
    label: 'GitHub Token',
    regex: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/,
    severity: 'CRITICAL',
  },
  {
    id: 'gitlab-token',
    label: 'GitLab Token',
    regex: /glpat-[A-Za-z0-9_-]{20,}/,
    severity: 'CRITICAL',
  },

  // Google
  {
    id: 'google-api-key',
    label: 'Google API Key',
    regex: /AIza[0-9A-Za-z_-]{35}/,
    severity: 'CRITICAL',
  },
  {
    id: 'google-oauth',
    label: 'Google OAuth Secret',
    regex:
      /(?:client_secret|google_secret)\s*[=:]\s*['"]([A-Za-z0-9_-]{24,})['"](?!\s*process\.env)/i,
    severity: 'CRITICAL',
  },

  // Stripe
  {
    id: 'stripe-key',
    label: 'Stripe API Key',
    regex: /(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/,
    severity: 'CRITICAL',
  },

  // Slack
  {
    id: 'slack-token',
    label: 'Slack Token',
    regex: /xox[bporsca]-[A-Za-z0-9-]{10,}/,
    severity: 'CRITICAL',
  },
  {
    id: 'slack-webhook',
    label: 'Slack Webhook URL',
    regex:
      /https:\/\/hooks\.slack\.com\/services\/T[A-Z0-9]{8,}\/B[A-Z0-9]{8,}\/[A-Za-z0-9]{20,}/,
    severity: 'HIGH',
  },

  // Twilio
  {
    id: 'twilio-key',
    label: 'Twilio API Key',
    regex: /SK[0-9a-fA-F]{32}/,
    severity: 'CRITICAL',
  },

  // SendGrid
  {
    id: 'sendgrid-key',
    label: 'SendGrid API Key',
    regex: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/,
    severity: 'CRITICAL',
  },

  // Mailgun
  {
    id: 'mailgun-key',
    label: 'Mailgun API Key',
    regex: /key-[0-9a-zA-Z]{32}/,
    severity: 'CRITICAL',
  },

  // JWT / Bearer in source
  {
    id: 'jwt-hardcoded',
    label: 'Hardcoded JWT Token',
    regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/,
    severity: 'HIGH',
  },

  // Database connection strings with credentials (skip template literals)
  {
    id: 'db-connection-string',
    label: 'Database Connection String with Credentials',
    regex:
      /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/(?!\$\{)[^:]+:(?!\$\{)[^@]+@[^/\s'"]+/i,
    severity: 'HIGH',
  },

  // npm tokens
  {
    id: 'npm-token',
    label: 'npm Access Token',
    regex: /npm_[A-Za-z0-9]{36}/,
    severity: 'CRITICAL',
  },

  // Heroku API Key
  {
    id: 'heroku-key',
    label: 'Heroku API Key',
    regex:
      /(?:heroku_api_key|heroku_key)\s*[=:]\s*['"]([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})['"]?/i,
    severity: 'CRITICAL',
  },

  // Firebase
  {
    id: 'firebase-key',
    label: 'Firebase Private Key',
    regex:
      /(?:firebase|fire_base).*private_key.*-----BEGIN.*PRIVATE KEY-----/is,
    severity: 'CRITICAL',
  },
];

/**
 * Files and paths to always skip.
 */
const SKIP_PATTERNS = [
  // Config / lock files
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.lock$/,

  // Binary / media
  /\.(png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|mp[34]|avi|webm|webp|pdf)$/i,

  // Test fixtures and mocks
  /\/__tests__\/fixtures\//,
  /\/__mocks__\//,
  /\.test\.(js|ts|jsx|tsx)$/,
  /\.spec\.(js|ts|jsx|tsx)$/,

  // Documentation and examples
  /\.md$/,
  /CHANGELOG/i,

  // Build output
  /^build\//,
  /^dist\//,
  /^node_modules\//,

  // Environment templates (these SHOULD contain placeholder keys)
  /\.env\.xnapify$/,
  /\.env\.example$/,
  /\.env\.template$/,

  // This file itself
  /secretScanner\.js$/,

  // Agent / skill docs
  /^\.agent\//,
  /^\.gemini\//,
  /^\.claude\//,

  // Git directory
  /^\.git\//,
];

/**
 * Lines to always skip (inline suppressions + known safe patterns).
 */
const SKIP_LINE_PATTERNS = [
  // Inline suppression
  /secret-scanner-ignore/,
  // Environment variable references (safe)
  /process\.env\./,
  /getenv\(/,
  /os\.environ/,
  // Comments explaining patterns (not actual secrets)
  /\/\/\s*e\.g\.\s/i,
  /\/\/\s*example:/i,
  /\/\*\*?\s/,
  // Import / require lines
  /^(?:import|const\s+\w+\s*=\s*require)/,
  // Template literal building URL from variables (not hardcoded)
  /`[^`]*\$\{[^}]+\}[^`]*`/,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Get list of staged files from git.
 */
function getStagedFiles() {
  try {
    const output = execSync(
      'git diff --cached --name-only --diff-filter=ACMR',
      {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      },
    );
    return output
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Get all tracked files.
 */
function getAllFiles() {
  try {
    const output = execSync('git ls-files', {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    return output
      .split('\n')
      .map(f => f.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Check if a file path should be skipped.
 */
function shouldSkipFile(filePath) {
  return SKIP_PATTERNS.some(pattern => pattern.test(filePath));
}

/**
 * Check if a line should be skipped.
 */
function shouldSkipLine(line) {
  return SKIP_LINE_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Shannon entropy of a string (higher = more random = more likely a real secret).
 */
function shannonEntropy(str) {
  if (!str || str.length === 0) return 0;
  const freq = {};
  for (const ch of str) {
    freq[ch] = (freq[ch] || 0) + 1;
  }
  const len = str.length;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Get staged diff content for a specific file (only added/modified lines).
 */
function getStagedDiff(filePath) {
  try {
    const output = execSync(`git diff --cached -U0 -- "${filePath}"`, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
    });
    // Parse unified diff to extract only added lines with line numbers
    const lines = output.split('\n');
    const addedLines = [];
    let currentLine = 0;

    for (const line of lines) {
      // Parse hunk header: @@ -old,count +new,count @@
      const hunkMatch = line.match(/^@@ .* \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        currentLine = parseInt(hunkMatch[1], 10);
        continue;
      }
      // Added lines start with +
      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines.push({
          lineNumber: currentLine,
          content: line.slice(1), // Remove leading +
        });
        currentLine++;
      } else if (!line.startsWith('-') && !line.startsWith('\\')) {
        // Context line
        currentLine++;
      }
    }
    return addedLines;
  } catch {
    return null; // Fallback to full-file scan
  }
}

// ---------------------------------------------------------------------------
// Scanner
// ---------------------------------------------------------------------------

/**
 * Scan a single file and return findings.
 */
function scanFile(filePath, scanMode) {
  const findings = [];

  let linesToScan;

  if (scanMode === 'staged') {
    // Only scan newly added/modified lines in the staged diff
    const diffLines = getStagedDiff(filePath);
    if (diffLines && diffLines.length > 0) {
      linesToScan = diffLines;
    } else if (diffLines && diffLines.length === 0) {
      return findings; // No added lines in diff
    }
    // If diffLines is null (error), fall through to full-file scan
  }

  // Full-file scan fallback
  if (!linesToScan) {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) return findings;

    try {
      const content = fs.readFileSync(absPath, 'utf-8');
      // Skip binary files (heuristic: NUL byte in first 8KB)
      if (content.slice(0, 8192).includes('\0')) return findings;

      linesToScan = content.split('\n').map((line, i) => ({
        lineNumber: i + 1,
        content: line,
      }));
    } catch {
      return findings;
    }
  }

  for (const { lineNumber, content: line } of linesToScan) {
    if (shouldSkipLine(line)) continue;

    for (const pattern of SECRET_PATTERNS) {
      const match = line.match(pattern.regex);
      if (!match) continue;

      // Extract the captured group (the actual secret value) or the full match
      const secretValue = match[1] || match[0];

      // For generic patterns, apply entropy filter to reduce false positives
      if (
        pattern.id.startsWith('generic-') &&
        shannonEntropy(secretValue.trim()) < 3.5
      ) {
        continue; // Low entropy — likely a placeholder or variable name
      }

      findings.push({
        file: filePath,
        line: lineNumber,
        pattern: pattern.id,
        label: pattern.label,
        severity: pattern.severity,
        snippet: line.trim().slice(0, 120),
      });

      // One finding per line is enough
      break;
    }
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Reporter
// ---------------------------------------------------------------------------

const COLORS = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
};

function severityColor(severity) {
  return severity === 'CRITICAL'
    ? COLORS.red
    : severity === 'HIGH'
      ? COLORS.yellow
      : COLORS.cyan;
}

function printFindings(findings, showFix) {
  console.error('');
  console.error(
    `${COLORS.red}${COLORS.bold}🚨 SECRET SCANNER: ${findings.length} potential secret(s) detected!${COLORS.reset}`,
  );
  console.error(
    `${COLORS.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`,
  );

  // Group by file
  const byFile = {};
  for (const f of findings) {
    (byFile[f.file] || (byFile[f.file] = [])).push(f);
  }

  for (const [file, fileFindings] of Object.entries(byFile)) {
    console.error(`\n${COLORS.bold}📄 ${file}${COLORS.reset}`);
    for (const f of fileFindings) {
      const color = severityColor(f.severity);
      console.error(
        `  ${color}${f.severity}${COLORS.reset} L${f.line}: ${f.label}`,
      );
      console.error(`  ${COLORS.dim}${f.snippet}${COLORS.reset}`);
    }
  }

  if (showFix) {
    console.error(
      `\n${COLORS.cyan}${COLORS.bold}💡 Remediation:${COLORS.reset}`,
    );
    console.error(
      `  1. Move secrets to ${COLORS.bold}.env${COLORS.reset} and reference via ${COLORS.bold}process.env.XNAPIFY_*${COLORS.reset}`,
    );
    console.error(
      `  2. If this is a false positive, add ${COLORS.bold}// secret-scanner-ignore${COLORS.reset} to the line`,
    );
    console.error(
      `  3. Add test fixtures to ${COLORS.bold}__tests__/fixtures/${COLORS.reset} (auto-skipped)`,
    );
  }

  console.error(
    `\n${COLORS.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${COLORS.reset}`,
  );
  console.error(
    `${COLORS.red}Commit blocked.${COLORS.reset} Remove secrets before committing.\n`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const scanAll = args.includes('--all');
  const showFix = args.includes('--fix');

  try {
    const files = scanAll ? getAllFiles() : getStagedFiles();

    if (files.length === 0) {
      // No files to scan
      process.exit(0);
    }

    const scanMode = scanAll ? 'all' : 'staged';
    const allFindings = [];

    for (const file of files) {
      if (shouldSkipFile(file)) continue;
      const findings = scanFile(file, scanMode);
      allFindings.push(...findings);
    }

    if (allFindings.length > 0) {
      printFindings(allFindings, showFix);
      process.exit(1);
    }

    // Clean — no output (quiet success)
    process.exit(0);
  } catch (err) {
    // Scanner errors should NOT block commits
    console.error(
      `${COLORS.yellow}⚠ Secret scanner error: ${err.message}${COLORS.reset}`,
    );
    process.exit(2);
  }
}

main();
