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

// ── Defaults ──────────────────────────────────────────────────────

const DEFAULT_VIEWPORT = { width: 1280, height: 900 };

const DEFAULT_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  // --no-zygote crashes bundled Chromium on macOS (UniversalExceptionRaise)
  ...(process.platform !== 'darwin' ? ['--no-zygote'] : []),
];

const DEFAULT_PAGE_TIMEOUT = 30000;

// ── Engine label ──────────────────────────────────────────────────

const ENGINE = 'Puppeteer';

// ── Availability check ────────────────────────────────────────────

/**
 * Returns `true` when the browser library can be resolved.
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

  const headless = opts.headless !== undefined ? opts.headless : 'new';
  const viewport = opts.viewport || DEFAULT_VIEWPORT;
  const extraArgs = opts.args || [];

  const args = [
    ...DEFAULT_ARGS,
    `--window-size=${viewport.width},${viewport.height}`,
    ...extraArgs,
  ];

  const launchOpts = {
    headless: headless === true ? 'new' : headless,
    args,
    defaultViewport: viewport,
  };

  // On MacOS, bundled Chromium often crashes in both modes with 'UniversalExceptionRaise'.
  // Using the system's Chrome prevents this fatal WebSocket hang up.
  if (process.platform === 'darwin') {
    launchOpts.channel = 'chrome';
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOpts);
  } catch (err) {
    if (launchOpts.channel) {
      console.warn(
        '   [Puppeteer] Failed to launch with channel, falling back to default...',
      );
      delete launchOpts.channel;
      browser = await puppeteer.launch(launchOpts);
    } else {
      throw err;
    }
  }

  // Prevent unhandled WebSocket ErrorEvent from crashing the process.
  // Puppeteer's CDP connection emits 'disconnected' when the browser dies.
  browser.on('disconnected', () => {
    console.warn('   [Puppeteer] Browser disconnected unexpectedly');
  });

  return browser;
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
  // createBrowserContext replaces deprecated createIncognitoBrowserContext (Puppeteer 21+)
  const context =
    typeof browser.createBrowserContext === 'function'
      ? await browser.createBrowserContext()
      : await browser.createIncognitoBrowserContext();
  const page = await context.newPage();
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
    try {
      await browser.close();
    } catch {
      // Browser may have already crashed or been disconnected
    }
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
