/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * E2E Test Runner — Browser Abstraction
 *
 * Centralises all Puppeteer-specific calls behind a thin adapter.
 * To swap the underlying library (e.g. to Puppeteer), only this
 * file needs to change — every other E2E module consumes the
 * generic helpers exported here.
 *
 * Exported surface:
 *   isAvailable()           → boolean (can we require the lib?)
 *   launchBrowser(options)  → browser handle
 *   createPage(browser, o)  → page handle with defaults applied
 *   closeBrowser(browser)   → graceful shutdown
 *   ENGINE                  → string label for logs / reports
 */

/* eslint-disable no-console */

// ── Defaults ──────────────────────────────────────────────────────

const DEFAULT_VIEWPORT = { width: 1280, height: 900 };

const DEFAULT_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
];

const DEFAULT_PAGE_TIMEOUT = 30000;

// ── Engine label ──────────────────────────────────────────────────

const ENGINE = 'Puppeteer';

// ── Availability check ────────────────────────────────────────────

/**
 * Returns `true` when the browser library can be resolved.
 * Used by smoke-test to validate the environment before launching.
 */
function isAvailable() {
  try {
    require.resolve('puppeteer');
    return true;
  } catch {
    return false;
  }
}

// ── Launch ────────────────────────────────────────────────────────

/**
 * Launch a browser instance.
 *
 * @param {object}  [opts]
 * @param {boolean} [opts.headless=true]     Run without a visible window.
 * @param {string[]}[opts.args]              Extra Chromium flags.
 * @param {{ width: number, height: number }} [opts.viewport]  Viewport size.
 * @returns {Promise<import('puppeteer').Browser>}
 */
async function launchBrowser(opts = {}) {
  const puppeteer = require('puppeteer');

  const headless = opts.headless !== undefined ? opts.headless : true;
  const viewport = opts.viewport || DEFAULT_VIEWPORT;
  const extraArgs = opts.args || [];

  const args = [
    ...DEFAULT_ARGS,
    `--window-size=${viewport.width},${viewport.height}`,
    ...extraArgs,
  ];

  return puppeteer.launch({
    headless,
    args,
    defaultViewport: viewport,
  });
}

// ── Page ──────────────────────────────────────────────────────────

/**
 * Create a new page from the browser with common defaults applied.
 *
 * @param {import('puppeteer').Browser} browser
 * @param {object}  [opts]
 * @param {number}  [opts.timeout]  Default timeout for page operations.
 * @returns {Promise<import('puppeteer').Page>}
 */
async function createPage(browser, opts = {}) {
  const page = await browser.newPage();
  page.setDefaultTimeout(opts.timeout || DEFAULT_PAGE_TIMEOUT);
  return page;
}

// ── Close ─────────────────────────────────────────────────────────

/**
 * Gracefully close the browser if it exists.
 *
 * @param {import('puppeteer').Browser|null|undefined} browser
 */
async function closeBrowser(browser) {
  if (browser) {
    await browser.close();
  }
}

// ── Exports ───────────────────────────────────────────────────────

module.exports = {
  ENGINE,
  isAvailable,
  launchBrowser,
  createPage,
  closeBrowser,
};
