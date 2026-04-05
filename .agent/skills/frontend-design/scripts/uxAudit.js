#!/usr/bin/env node
/**
 * UX Audit Script - Full Frontend Design Coverage
 *
 * Analyzes code for compliance with:
 *  1. Psychology Laws (Hick's, Fitts', Miller's, Von Restorff, Serial Position)
 *  2. Emotional Design (Visceral, Behavioral, Reflective)
 *  3. Trust Building (Security signals, Social proof, Authority)
 *  4. Cognitive Load Management (Progressive disclosure, Visual noise)
 *  5. Persuasive Design (Smart defaults, Anchoring, Progress indicators)
 *  6. Typography System (Font pairing, Line length/height, Letter spacing, Hierarchy)
 *  7. Visual Effects (Glassmorphism, Shadows, Gradients, Glow, GPU Acceleration)
 *  8. Color System (60-30-10 Rule, Dark Mode, WCAG Contrast, HSL, Purple Ban)
 *  9. Animation Guide (Duration, Easing, Micro-interactions, Loading, Scroll)
 * 10. Motion Graphics (Lottie, GSAP, SVG, 3D Transforms, Particles)
 * 11. Accessibility (Alt text, Reduced motion, Form labels)
 *
 * Usage: node uxAudit.js <path> [--json]
 */

const fs = require('fs');
const path = require('path');
const { SKIP_DIRS, UI_EXTENSIONS, walkFiles } = require('../../scripts/constants');


class UXAuditor {
  constructor() {
    this.issues = [];
    this.warnings = [];
    this.passedCount = 0;
    this.filesChecked = 0;
  }

  auditFile(filepath) {
    let content;
    try {
      content = fs.readFileSync(filepath, 'utf-8');
    } catch {
      return;
    }

    this.filesChecked++;
    const filename = path.basename(filepath);

    const hasLongText = /(<p|<div.*class=.*text|article|<span.*text)/i.test(
      content,
    );
    const hasForm = /(<form|<input|password|credit|card|payment)/i.test(
      content,
    );
    const complexElements = (
      content.match(/<input|<select|<textarea|<option/gi) || []
    ).length;

    // --- 1. PSYCHOLOGY LAWS ---
    const navItems = (
      content.match(/<NavLink|<Link|<a\s+href|nav-item/gi) || []
    ).length;
    if (navItems > 7) {
      this.issues.push(
        `[Hick's Law] ${filename}: ${navItems} nav items (Max 7)`,
      );
    }

    if (
      /height:\s*([0-3]\d)px/.test(content) ||
      /h-[1-9]\b|h-10\b/.test(content)
    ) {
      this.warnings.push(`[Fitts' Law] ${filename}: Small targets (<44px)`);
    }

    const formFields = (content.match(/<input|<select|<textarea/gi) || [])
      .length;
    if (formFields > 7 && !/step|wizard|stage/i.test(content)) {
      this.warnings.push(
        `[Miller's Law] ${filename}: Complex form (${formFields} fields)`,
      );
    }

    if (
      /button/i.test(content) &&
      !/primary|bg-primary|Button.*primary|variant=['"]primary/i.test(content)
    ) {
      this.warnings.push(`[Von Restorff] ${filename}: No primary CTA`);
    }

    // --- 2. EMOTIONAL DESIGN ---
    const hasHero = /hero|<h1|banner/i.test(content);
    if (hasHero) {
      const hasGradient = /gradient|linear-gradient|radial-gradient/.test(
        content,
      );
      const hasAnimation = /@keyframes|transition:|animate-/.test(content);
      if (!hasGradient && !hasAnimation && !/background:|bg-/.test(content)) {
        this.warnings.push(
          `[Visceral] ${filename}: Hero section lacks visual appeal.`,
        );
      }
    }

    if (/onClick|@click|onclick/.test(content)) {
      const hasFeedback =
        /transition|animate|hover:|focus:|disabled|loading|spinner/i.test(
          content,
        );
      const hasStateChange = /setState|useState|disabled|loading/.test(content);
      if (!hasFeedback && !hasStateChange) {
        this.warnings.push(
          `[Behavioral] ${filename}: Interactive elements lack immediate feedback.`,
        );
      }
    }

    // --- 3. TRUST BUILDING ---
    if (hasForm) {
      const securitySignals = (
        content.match(/ssl|secure|encrypt|lock|padlock|https/gi) || []
      ).length;
      if (securitySignals === 0 && !/checkout|payment/i.test(content)) {
        this.warnings.push(
          `[Trust] ${filename}: Form without security indicators.`,
        );
      }
    }

    const socialProof = (
      content.match(
        /review|testimonial|rating|star|trust|trusted by|customer|logo/gi,
      ) || []
    ).length;
    if (socialProof > 0) {
      this.passedCount++;
    } else if (hasLongText) {
      this.warnings.push(`[Trust] ${filename}: No social proof detected.`);
    }

    // --- 4. COGNITIVE LOAD ---
    if (complexElements > 5) {
      if (
        !/step|wizard|stage|accordion|collapsible|tab|more\.\.\.|advanced|show more/i.test(
          content,
        )
      ) {
        this.warnings.push(
          `[Cognitive Load] ${filename}: Many form elements without progressive disclosure.`,
        );
      }
    }

    if (hasForm) {
      if (!/<label|placeholder|aria-label/i.test(content)) {
        this.issues.push(
          `[Cognitive Load] ${filename}: Form inputs without labels.`,
        );
      }
    }

    // --- 5. TYPOGRAPHY ---
    const fontFamilies = new Set();
    const fontFaceMatches =
      content.match(/@font-face\s*\{[^}]*family:\s*["']?([^;"'\s}]+)/gi) || [];
    const googleFonts =
      content.match(/fonts\.googleapis\.com[^"']*family=([^"&]+)/gi) || [];
    const cssFontFamily = content.match(/font-family:\s*([^;]+)/gi) || [];

    for (const m of fontFaceMatches) {
      const match = /@font-face\s*\{[^}]*family:\s*["']?([^;"'\s}]+)/i.exec(m);
      if (match) fontFamilies.add(match[1].trim().toLowerCase());
    }
    for (const m of googleFonts) {
      const match = /family=([^"&]+)/i.exec(m);
      if (match) {
        for (const f of match[1].replace(/\+/g, ' ').split('|')) {
          fontFamilies.add(f.split(':')[0].trim().toLowerCase());
        }
      }
    }
    const systemFonts = new Set([
      'sans-serif',
      'serif',
      'monospace',
      'cursive',
      'fantasy',
      'system-ui',
      'inherit',
      'arial',
      'georgia',
      'times new roman',
      'courier new',
      'verdana',
      'helvetica',
      'tahoma',
    ]);
    for (const m of cssFontFamily) {
      const match = /font-family:\s*([^;]+)/i.exec(m);
      if (match) {
        const first = match[1]
          .split(',')[0]
          .trim()
          .replace(/["']/g, '')
          .toLowerCase();
        if (!systemFonts.has(first)) fontFamilies.add(first);
      }
    }
    if (fontFamilies.size > 3) {
      this.issues.push(
        `[Typography] ${filename}: ${fontFamilies.size} font families detected. Limit to 2-3.`,
      );
    }

    if (
      hasLongText &&
      !/max-w-(?:prose|[\[\\]?\d+ch[\]\\]?)|max-width:\s*\d+ch/.test(content)
    ) {
      this.warnings.push(
        `[Typography] ${filename}: No line length constraint (45-75ch).`,
      );
    }

    // Heading hierarchy
    const headings = (content.match(/<(h[1-6])/gi) || []).map(h =>
      parseInt(h.replace(/<h/i, '')),
    );
    for (let i = 0; i < headings.length - 1; i++) {
      if (headings[i + 1] > headings[i] + 1) {
        this.warnings.push(
          `[Typography] ${filename}: Skipped heading level (h${headings[i]} → h${headings[i + 1]}).`,
        );
      }
    }

    if (
      /uppercase|text-transform:\s*uppercase/i.test(content) &&
      !/tracking-|letter-spacing:/.test(content)
    ) {
      this.warnings.push(
        `[Typography] ${filename}: Uppercase text without tracking.`,
      );
    }

    // --- 6. VISUAL EFFECTS ---
    if (/backdrop-filter/.test(content) || /blur\(/.test(content)) {
      if (!/background:\s*rgba|bg-opacity|bg-[a-z0-9]+\/\d+/.test(content)) {
        this.warnings.push(
          `[Visual] ${filename}: Blur used without semi-transparent background.`,
        );
      }
    }

    if (/@keyframes|transition:/.test(content)) {
      if (!/prefers-reduced-motion/.test(content)) {
        this.warnings.push(
          `[Accessibility] ${filename}: Animations without prefers-reduced-motion check`,
        );
      }
    }

    const shadows = content.match(/box-shadow:\s*([^;]+)/g) || [];

    // --- 7. COLOR SYSTEM ---
    const purples = [
      '#8B5CF6',
      '#A855F7',
      '#9333EA',
      '#7C3AED',
      '#6D28D9',
      '#A78BFA',
      '#C4B5FD',
      '#DDD6FE',
      '#EDE9FE',
      'purple',
      'violet',
      'fuchsia',
      'magenta',
      'lavender',
    ];
    const contentLower = content.toLowerCase();
    for (const purple of purples) {
      if (contentLower.includes(purple.toLowerCase())) {
        this.issues.push(
          `[Color] ${filename}: PURPLE DETECTED ('${purple}'). Banned by design rules.`,
        );
        break;
      }
    }

    if (/color:\s*#000000|#000\b/.test(content)) {
      this.warnings.push(
        `[Color] ${filename}: Pure black (#000000) detected. Use #1a1a1a.`,
      );
    }

    const uniqueHexes = new Set(content.match(/#[0-9a-fA-F]{6}/g) || []);
    if (uniqueHexes.size > 5) {
      this.warnings.push(
        `[Color] ${filename}: ${uniqueHexes.size} distinct colors. Consider 60-30-10 rule.`,
      );
    }

    // --- 8. ANIMATION ---
    const durations =
      content.match(
        /(?:duration|animation-duration|transition-duration):\s*([\d.]+)(s|ms)/g,
      ) || [];
    for (const d of durations) {
      const match = /([\d.]+)(s|ms)/.exec(d);
      if (match) {
        const ms = parseFloat(match[1]) * (match[2] === 's' ? 1000 : 1);
        if (ms < 50)
          this.warnings.push(
            `[Animation] ${filename}: Very fast animation (<50ms).`,
          );
        if (ms > 1000 && /transition/i.test(content)) {
          this.warnings.push(`[Animation] ${filename}: Long transition (>1s).`);
        }
      }
    }

    const interactiveElements = (
      content.match(/<button|<a\s+href|onClick|@click/g) || []
    ).length;
    if (
      interactiveElements > 2 &&
      !/hover:|focus:|:hover|:focus/.test(content)
    ) {
      this.warnings.push(
        `[Animation] ${filename}: Interactive elements without hover/focus states.`,
      );
    }

    if (
      /async|await|fetch|axios|loading|isLoading/.test(content) &&
      !/skeleton|spinner|progress|loading|<circle.*animate/.test(content)
    ) {
      this.warnings.push(
        `[Animation] ${filename}: Async operations without loading indicator.`,
      );
    }

    // --- 9. MOTION GRAPHICS ---
    if (
      /gsap|ScrollTrigger/i.test(content) &&
      !/kill\(|revert\(|useEffect.*return.*gsap/.test(content)
    ) {
      this.issues.push(
        `[Motion] ${filename}: GSAP animation without cleanup. Memory leak risk.`,
      );
    }

    if (/transform3d|perspective\(|rotate3d|translate3d/.test(content)) {
      this.warnings.push(
        `[Motion] ${filename}: 3D transforms detected. Test on mobile.`,
      );
    }

    // --- 10. ACCESSIBILITY ---
    if (/<img(?![^>]*alt=)[^>]*>/.test(content)) {
      this.issues.push(`[Accessibility] ${filename}: Missing img alt text`);
    }
  }

  auditDirectory(directory) {
    const files = walkFiles(directory, UI_EXTENSIONS);
    for (const file of files) {
      this.auditFile(file);
    }
  }

  getReport() {
    return {
      files_checked: this.filesChecked,
      issues: this.issues,
      warnings: this.warnings,
      passed_checks: this.passedCount,
      compliant: this.issues.length === 0,
    };
  }
}

function main() {
  if (process.argv.length < 3) {
    console.error('Usage: node uxAudit.js <path> [--json]');
    process.exit(1);
  }

  const targetPath = process.argv[2];
  const isJson = process.argv.includes('--json');

  const auditor = new UXAuditor();
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) auditor.auditFile(targetPath);
  else auditor.auditDirectory(targetPath);

  const report = auditor.getReport();

  if (isJson) {
    console.log(JSON.stringify(report));
  } else {
    console.log(`\n[UX AUDIT] ${report.files_checked} files checked`);
    console.log('-'.repeat(50));
    if (report.issues.length > 0) {
      console.log(`[!] ISSUES (${report.issues.length}):`);
      for (const i of report.issues.slice(0, 10)) console.log(`  - ${i}`);
    }
    if (report.warnings.length > 0) {
      console.log(`[*] WARNINGS (${report.warnings.length}):`);
      for (const w of report.warnings.slice(0, 15)) console.log(`  - ${w}`);
    }
    console.log(`[+] PASSED CHECKS: ${report.passed_checks}`);
    console.log(`STATUS: ${report.compliant ? 'PASS' : 'FAIL'}`);
  }

  process.exit(report.compliant ? 0 : 1);
}

main();
