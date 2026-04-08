/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * E2E Test Runner — Action Executor
 *
 * Takes structured JSON actions (from the LLM interpreter)
 * and executes them via Puppeteer.
 *
 * SPA-aware: handles React route transitions, loading skeletons,
 * async API content, and animation delays automatically.
 *
 * Actions are simple, safe, pre-built handlers — no eval/exec.
 */

/* eslint-disable no-underscore-dangle */

const http = require('http');
const https = require('https');

const jp = require('jsonpath');

// ── SPA Stability Engine ──────────────────────────────────────────
//
// Enterprise-grade page stability detection for React SPAs.
//
// Tracks 5 independent signals:
//   1. Network — in-flight fetch/XHR requests
//   2. DOM — MutationObserver for structural changes
//   3. Animations — running CSS transitions/animations
//   4. Loading UI — skeleton/spinner/shimmer visibility
//   5. React — Suspense boundaries, error boundaries
//
// The page is "stable" when ALL signals have been quiet
// for a configurable settle window (default: 300ms).

const SPA_DEFAULTS = {
  timeout: 15000,
  settleWindow: 300,
  pollInterval: 100,
  debug: process.env.E2E_DEBUG === 'true',

  // CSS class patterns that indicate loading state
  loadingPatterns: [
    '[class*="skeleton"]',
    '[class*="Skeleton"]',
    '[class*="shimmer"]',
    '[class*="Shimmer"]',
    '[class*="spinner"]',
    '[class*="Spinner"]',
    '[class*="loader"]',
    '[class*="Loader"]',
    '[role="progressbar"]',
    '[aria-busy="true"]',
  ],

  // Elements that block interaction while visible
  overlayPatterns: [
    '[class*="overlay"]',
    '[class*="Overlay"]',
    '[class*="backdrop"]',
    '[class*="Backdrop"]',
  ],

  // CSS classes that indicate pure loading state (not interactive)
  loadingClassPatterns: ['loading', 'is-loading', 'isLoading'],
};

/**
 * Install the SPA instrumentation layer into the page.
 * This injects a `window.__spaObserver` object that tracks
 * network activity and DOM mutations in real-time.
 *
 * Safe to call multiple times — idempotent.
 */
async function installSPAInstrumentation(page) {
  const alreadyInstalled = await page.evaluate(() => !!window.__spaObserver);
  if (alreadyInstalled) return;

  await page.evaluate(() => {
    const observer = {
      // ── Network tracking ────────────────────────────────
      pendingRequests: 0,
      lastNetworkActivity: Date.now(),

      // ── DOM mutation tracking ───────────────────────────
      lastDOMMutation: Date.now(),
      mutationCount: 0,

      // State
      installed: true,
    };

    // Intercept fetch()
    const originalFetch = window.fetch;
    window.fetch = function (...args) {
      observer.pendingRequests++;
      observer.lastNetworkActivity = Date.now();
      return originalFetch.apply(this, args).finally(() => {
        observer.pendingRequests = Math.max(0, observer.pendingRequests - 1);
        observer.lastNetworkActivity = Date.now();
      });
    };

    // Intercept XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (...args) {
      this._spaTracked = true;
      return originalOpen.apply(this, args);
    };

    XMLHttpRequest.prototype.send = function (...args) {
      if (this._spaTracked) {
        observer.pendingRequests++;
        observer.lastNetworkActivity = Date.now();

        const onDone = () => {
          observer.pendingRequests = Math.max(0, observer.pendingRequests - 1);
          observer.lastNetworkActivity = Date.now();
        };
        this.addEventListener('load', onDone);
        this.addEventListener('error', onDone);
        this.addEventListener('abort', onDone);
        this.addEventListener('timeout', onDone);
      }
      return originalSend.apply(this, args);
    };

    // DOM MutationObserver — track structural changes
    const mutationObs = new MutationObserver(mutations => {
      // Filter out trivial mutations (cursor blinks, focus rings)
      const meaningful = mutations.some(m => {
        if (
          m.type === 'childList' &&
          (m.addedNodes.length > 0 || m.removedNodes.length > 0)
        ) {
          return true;
        }
        if (m.type === 'attributes') {
          const attr = m.attributeName;
          // Class/style changes that affect layout
          return [
            'class',
            'style',
            'hidden',
            'aria-hidden',
            'disabled',
          ].includes(attr);
        }
        return false;
      });

      if (meaningful) {
        observer.lastDOMMutation = Date.now();
        observer.mutationCount += mutations.length;
      }
    });

    mutationObs.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'disabled'],
    });

    observer._mutationObs = mutationObs;
    window.__spaObserver = observer;
  });
}

/**
 * Collect a diagnostic snapshot of the current page stability signals.
 * Returns { isStable, signals, blockers } where signals is an object
 * describing each tracked dimension.
 */
async function collectStabilitySignals(page, opts) {
  const config = { ...SPA_DEFAULTS, ...opts };

  return page.evaluate(
    (loadingPatterns, overlayPatterns, loadingClassPatterns, settleWindow) => {
      const now = Date.now();
      const obs = window.__spaObserver || {};
      const signals = {};
      const blockers = [];

      // ── Signal 1: Network ──────────────────────────────────
      const pendingReqs = obs.pendingRequests || 0;
      const networkQuiet = now - (obs.lastNetworkActivity || 0);
      signals.network = {
        pending: pendingReqs,
        quietMs: networkQuiet,
        stable: pendingReqs === 0 && networkQuiet >= settleWindow,
      };
      if (!signals.network.stable) {
        blockers.push(
          `network: ${pendingReqs} pending, quiet ${networkQuiet}ms`,
        );
      }

      // ── Signal 2: DOM mutations ────────────────────────────
      const domQuiet = now - (obs.lastDOMMutation || 0);
      signals.dom = {
        quietMs: domQuiet,
        totalMutations: obs.mutationCount || 0,
        stable: domQuiet >= settleWindow,
      };
      if (!signals.dom.stable) {
        blockers.push(`dom: quiet only ${domQuiet}ms`);
      }

      // ── Signal 3: CSS Animations ───────────────────────────
      let runningAnimations = 0;
      try {
        // Scope to visible interactive areas only (not the entire DOM)
        const candidates = document.querySelectorAll(
          'main *, [role="main"] *, [class*="content"] *, [class*="modal"] *, [role="dialog"] *',
        );
        const elements =
          candidates.length > 0 ? candidates : document.body.children;
        for (const el of elements) {
          if (el.offsetParent === null) continue;
          const anims = el.getAnimations ? el.getAnimations() : [];
          for (const a of anims) {
            // Skip infinite animations (decorative)
            if (a.effect) {
              const timing = a.effect.getComputedTiming();
              if (timing.duration === Infinity) continue;
              // Skip very short utility animations (< 100ms)
              if (timing.duration < 100) continue;
            }
            if (a.playState === 'running') runningAnimations++;
          }
        }
      } catch {
        // getAnimations() not supported — skip
      }
      signals.animations = {
        running: runningAnimations,
        stable: runningAnimations === 0,
      };
      if (!signals.animations.stable) {
        blockers.push(`animations: ${runningAnimations} running`);
      }

      // ── Signal 4: Loading UI indicators ────────────────────
      let visibleLoaders = 0;
      const loaderDetails = [];

      for (const sel of loadingPatterns) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.offsetParent !== null) {
            visibleLoaders++;
            loaderDetails.push(sel);
          }
        }
      }

      // Check overlay/backdrop blocking the UI
      let hasOverlay = false;
      for (const sel of overlayPatterns) {
        const els = document.querySelectorAll(sel);
        for (const el of els) {
          if (el.offsetParent !== null) {
            const style = window.getComputedStyle(el);
            // Only count if it covers a significant area
            const rect = el.getBoundingClientRect();
            if (
              rect.width > 100 &&
              rect.height > 100 &&
              style.opacity !== '0'
            ) {
              hasOverlay = true;
            }
          }
        }
      }

      // Check body/root-level loading classes
      let hasLoadingClass = false;
      const rootEls = [
        document.body,
        document.getElementById('app'),
        document.getElementById('root'),
      ];
      for (const el of rootEls) {
        if (!el) continue;
        for (const cls of loadingClassPatterns) {
          if (el.classList.contains(cls)) {
            hasLoadingClass = true;
            break;
          }
        }
      }

      signals.loadingUI = {
        visibleLoaders,
        loaderDetails: loaderDetails.slice(0, 5),
        hasOverlay,
        hasLoadingClass,
        stable: visibleLoaders === 0 && !hasOverlay && !hasLoadingClass,
      };
      if (!signals.loadingUI.stable) {
        const reasons = [];
        if (visibleLoaders > 0) reasons.push(`${visibleLoaders} loaders`);
        if (hasOverlay) reasons.push('overlay');
        if (hasLoadingClass) reasons.push('loading class');
        blockers.push(`loadingUI: ${reasons.join(', ')}`);
      }

      // ── Signal 5: React internals ──────────────────────────
      let reactRendering = false;

      // Check for React 18+ concurrent mode rendering indicators
      try {
        const root =
          document.getElementById('app') || document.getElementById('root');
        if (root) {
          const fiberKey = Object.keys(root).find(k =>
            k.startsWith('__reactFiber'),
          );
          if (fiberKey) {
            const fiber = root[fiberKey];
            // Check if there are pending updates
            if (fiber && fiber.stateNode && fiber.stateNode.pendingContext) {
              reactRendering = true;
            }
          }
        }
      } catch {
        // Cannot inspect React internals — safe to skip
      }

      // Check for React error boundaries showing fallback
      const errorBoundary = document.querySelector(
        '[class*="error-boundary"], [class*="ErrorBoundary"]',
      );
      const hasErrorBoundary =
        errorBoundary && errorBoundary.offsetParent !== null;

      signals.react = {
        rendering: reactRendering,
        hasErrorBoundary: !!hasErrorBoundary,
        stable: !reactRendering,
      };
      if (!signals.react.stable) {
        blockers.push('react: rendering in progress');
      }

      // ── Overall stability ──────────────────────────────────
      const isStable = Object.values(signals).every(s => s.stable);

      return { isStable, signals, blockers };
    },
    config.loadingPatterns,
    config.overlayPatterns,
    config.loadingClassPatterns,
    config.settleWindow,
  );
}

/**
 * Wait until ALL stability signals report quiet for the settle window.
 *
 * @param {import('puppeteer').Page} page  — provided via browser.js abstraction
 * @param {object} [opts] Override SPA_DEFAULTS
 * @param {number} [opts.timeout=15000]     Max total wait
 * @param {number} [opts.settleWindow=300]  How long all signals must be quiet
 * @param {number} [opts.pollInterval=100]  Polling interval
 * @param {boolean} [opts.debug=false]      Log diagnostics
 */
async function waitForSPAStable(page, opts) {
  const config = {
    ...SPA_DEFAULTS,
    ...(typeof opts === 'number' ? { timeout: opts } : opts),
  };
  const start = Date.now();

  // Install instrumentation if not already present
  await installSPAInstrumentation(page);

  let stableSince = null;
  let lastLog = 0;

  while (Date.now() - start < config.timeout) {
    const snapshot = await collectStabilitySignals(page, config);

    if (snapshot.isStable) {
      if (!stableSince) stableSince = Date.now();
      // Require stability for the full settle window
      if (Date.now() - stableSince >= config.settleWindow) {
        if (config.debug) {
          const elapsed = Date.now() - start;
          console.log(`      ⏱ SPA stable after ${elapsed}ms`);
        }
        return;
      }
    } else {
      stableSince = null;
      if (config.debug && Date.now() - lastLog > 1000) {
        console.log(`      ⏳ SPA waiting: ${snapshot.blockers.join(' | ')}`);
        lastLog = Date.now();
      }
    }

    await new Promise(r => setTimeout(r, config.pollInterval));
  }

  // Timeout — collect final diagnostics
  if (config.debug) {
    const final = await collectStabilitySignals(page, config);
    console.log(
      `      ⚠ SPA stability timeout (${config.timeout}ms). Blockers: ${final.blockers.join(' | ') || 'none'}`,
    );
  }
  // Not an error — proceed with best effort
}

/**
 * Wait for SPA route transition to complete after navigation.
 * Handles React Router transitions, code-split chunk loading,
 * and post-navigation API calls.
 */
async function waitForRouteReady(page, timeout = 15000) {
  // Install instrumentation early
  await installSPAInstrumentation(page);

  // Wait for initial network (JS bundles, API data)
  try {
    await page.waitForNavigation({
      waitUntil: 'networkidle2',
      timeout: 5000,
    });
  } catch {
    // Navigation may have already completed
  }

  // Wait for SPA content render + API responses + animations
  await waitForSPAStable(page, { timeout, settleWindow: 500 });
}

/**
 * Retry a finder function with polling until it succeeds or times out.
 * Handles the core SPA problem: elements appearing asynchronously.
 */
async function retryUntilFound(finder, timeout = 10000, interval = 300) {
  const start = Date.now();
  let lastError;

  while (Date.now() - start < timeout) {
    try {
      const result = await finder();
      if (result) return result;
      // If it successfully executed but returned falsy, clear any old stale errors
      lastError = null;
    } catch (e) {
      // Immediately abort on syntax errors (e.g. invalid CSS selector)
      if (e.message && e.message.includes('not a valid selector')) {
        throw new Error(
          `Syntax Error: ${e.message}. Did you mistakenly put plain text into a 'selector' field?`,
        );
      }
      // Ignore intermediate DOM disconnected/staleness errors
      lastError = e;
    }
    await new Promise(r => setTimeout(r, interval));
  }

  throw lastError || new Error('Element not found after retry timeout');
}

/**
 * Find a visible element by text content, retrying until SPA renders it.
 */
async function findByText(page, text, selector, timeout = 10000) {
  return retryUntilFound(async () => {
    // Priority 1: search interactive elements (button, a, [role=button])
    const interactive = await page.evaluateHandle(searchText => {
      const btns = document.querySelectorAll(
        'button, a, [role="button"], input[type="submit"], input[type="button"]',
      );
      for (const node of btns) {
        if (node.offsetParent === null) continue;
        if (node.textContent.trim().includes(searchText)) return node;
      }
      return null;
    }, text);
    const interactiveEl = interactive.asElement();
    if (interactiveEl) return interactiveEl;

    // Priority 2: search within specified selector or common text elements
    const querySelector =
      selector || 'span, div, li, h1, h2, h3, h4, label, p, td';
    const fallback = await page.evaluateHandle(
      (searchText, sel) => {
        const all = document.querySelectorAll(sel);
        for (const node of all) {
          if (node.offsetParent === null) continue;
          if (node.textContent.trim().includes(searchText)) return node;
        }
        return null;
      },
      text,
      querySelector,
    );
    return fallback.asElement();
  }, timeout);
}

/**
 * Find an element within a container (card, row, etc.) by text, with retry.
 */
async function findWithinContainer(
  page,
  containerSel,
  hasText,
  targetSel,
  timeout = 10000,
) {
  return retryUntilFound(async () => {
    const containers = await page.$$(containerSel || '[class*="root"]');
    for (const cont of containers) {
      if (hasText) {
        const text = await cont.evaluate(e => e.textContent);
        if (!text.includes(hasText)) continue;
      }
      const target = await cont.$(targetSel);
      if (target) {
        const visible = await target.evaluate(e => e.offsetParent !== null);
        if (visible) return target;
      }
    }
    return null;
  }, timeout);
}

// ── Action Handlers ───────────────────────────────────────────────

const ACTIONS = {
  // ── Navigation ──────────────────────────────────────────────────
  async navigate({ page, baseUrl }, action) {
    const url = action.url.startsWith('http')
      ? action.url
      : `${baseUrl}${action.url}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForRouteReady(page);
  },

  async reload({ page }) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForRouteReady(page);
  },

  async go_back({ page }) {
    await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 });
    await waitForRouteReady(page);
  },

  // ── Login ───────────────────────────────────────────────────────
  async login({ page, baseUrl, prerequisites }, action) {
    // Resolve credentials: action > prerequisites > env (last resort)
    const prereqs = prerequisites || {};
    const email = action.email || prereqs.email || process.env.E2E_EMAIL || '';
    const password =
      action.password || prereqs.password || process.env.E2E_PASSWORD || '';

    if (!email || !password) {
      throw new Error(
        'Login requires credentials. Define them in ### Prerequisite section or set E2E_EMAIL/E2E_PASSWORD env vars.',
      );
    }

    const loginUrl = action.url || '/login';
    const url = loginUrl.startsWith('http')
      ? loginUrl
      : `${baseUrl}${loginUrl}`;

    // Clear cookies and storage to ensure we don't inherit a session from a previous test
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');

    await page.goto(`${baseUrl}/`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await waitForRouteReady(page);

    // Wait for SPA rendering, chunk downloading, and React hydration
    await waitForSPAStable(page, { settleWindow: 500 });

    // Poll for login form (SPA may lazy-load it and hydrate it)
    const emailInput = await retryUntilFound(
      () => page.$('input[type="email"], input[name="email"]'),
      10000,
    );
    const passwordInput = await retryUntilFound(
      () => page.$('input[type="password"], input[name="password"]'),
      5000,
    );

    // Ensure inputs are clear before typing
    await emailInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await emailInput.type(email, { delay: 50 });

    await passwordInput.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await passwordInput.type(password, { delay: 50 });

    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    try {
      await page.waitForFunction(
        () => !window.location.pathname.includes('/login'),
        { timeout: 15000 },
      );
    } catch (err) {
      throw new Error('Login failed — still on login page');
    }
  },

  // ── Click ───────────────────────────────────────────────────────
  async click({ page }, action) {
    await waitForSPAStable(page);

    if (action.text) {
      const el = await findByText(page, action.text, action.selector);
      if (!el) throw new Error(`Element with text "${action.text}" not found`);

      // If the matched element is not natively clickable, walk up to the
      // nearest interactive ancestor (button, a, [role=button], etc.)
      const clickTarget = await el.evaluateHandle(node => {
        const interactive = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'];
        let current = node;
        while (current && current !== document.body) {
          if (
            interactive.includes(current.tagName) ||
            current.getAttribute('role') === 'button' ||
            current.onclick
          ) {
            return current;
          }
          current = current.parentElement;
        }
        return node; // fallback to original if no interactive parent
      });
      const target = clickTarget.asElement() || el;
      await target.click();
      return;
    }
    if (action.selector) {
      // Relax visibility requirement to handle styled/hidden inputs
      const el = await page.waitForSelector(action.selector, {
        visible: false,
        timeout: 10000,
      });

      // If hidden or size 0, try to find an interactive parent or associated label
      const box = await el.boundingBox();
      if (!box || box.width === 0 || box.height === 0) {
        const handled = await page.evaluate(sel => {
          const input = document.querySelector(sel);
          if (input && input.tagName === 'INPUT') {
            const label =
              input.closest('label') ||
              document.querySelector(`label[for="${input.id}"]`);
            if (label) {
              label.click();
              return true;
            }
          }
          return false;
        }, action.selector);

        if (handled) return;
      }

      await page.click(action.selector);
      return;
    }
    throw new Error('Click action requires "text" or "selector"');
  },

  // ── Click within container ──────────────────────────────────────
  async click_within({ page }, action) {
    await waitForSPAStable(page);

    const { container, target } = action;
    const el = await findWithinContainer(
      page,
      container.selector,
      container.hasText,
      target.selector,
    );
    if (!el) {
      throw new Error(
        `Target "${target.selector}" not found within container "${container.hasText || container.selector}"`,
      );
    }
    await el.click();
  },

  // ── Hover ───────────────────────────────────────────────────────
  async hover({ page }, action) {
    await waitForSPAStable(page);
    if (action.text) {
      const el = await findByText(page, action.text, action.selector);
      if (!el) throw new Error(`Element with text "${action.text}" not found`);
      await el.hover();
      return;
    }
    if (action.selector) {
      await page.waitForSelector(action.selector, {
        visible: true,
        timeout: 10000,
      });
      await page.hover(action.selector);
      return;
    }
    throw new Error('Hover action requires "text" or "selector"');
  },

  // ── Focus ───────────────────────────────────────────────────────
  async focus({ page }, action) {
    await waitForSPAStable(page);
    await page.waitForSelector(action.selector, {
      visible: true,
      timeout: 10000,
    });
    await page.focus(action.selector);
  },

  // ── Type / Input ────────────────────────────────────────────────
  async type({ page, apiState }, action) {
    await waitForSPAStable(page);
    await page.waitForSelector(action.selector, {
      visible: true,
      timeout: 10000,
    });
    const value = interpolateVars(
      action.value,
      (apiState && apiState.variables) || {},
    );
    if (action.clear) {
      await page.click(action.selector, { clickCount: 3 });
      await page.keyboard.press('Backspace');
    }
    await page.type(action.selector, value, { delay: 30 });
  },

  // ── Fill (atomic set, clears existing value) ────────────────────
  async fill({ page, apiState }, action) {
    await waitForSPAStable(page);
    const el = await retryUntilFound(() => page.$(action.selector), 10000);
    if (!el) throw new Error(`Element "${action.selector}" not found for fill`);
    const value = interpolateVars(
      action.value,
      (apiState && apiState.variables) || {},
    );
    // Select all text reliably across platforms, then overwrite
    await el.click();
    const selectAll = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(selectAll);
    await page.keyboard.press('a');
    await page.keyboard.up(selectAll);
    await el.type(value, { delay: 0 });
  },

  // ── Clear ───────────────────────────────────────────────────────
  async clear({ page }, action) {
    await waitForSPAStable(page);
    const el = await retryUntilFound(() => page.$(action.selector), 10000);
    if (!el)
      throw new Error(`Element "${action.selector}" not found for clear`);
    await el.click();
    const selectAll = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(selectAll);
    await page.keyboard.press('a');
    await page.keyboard.up(selectAll);
    await page.keyboard.press('Backspace');
  },

  // ── Press Key ───────────────────────────────────────────────────
  async press_key({ page }, action) {
    await waitForSPAStable(page);
    if (action.selector) {
      await page.waitForSelector(action.selector, {
        visible: true,
        timeout: 10000,
      });
      await page.focus(action.selector);
    }
    await page.keyboard.press(action.key);
  },

  // ── File Upload ─────────────────────────────────────────────────
  async upload_file({ page, fixtureZip }, action) {
    await waitForSPAStable(page);
    const input = await retryUntilFound(
      () => page.$(action.selector || 'input[type="file"]'),
      10000,
    );
    if (!input) throw new Error('File input not found');
    if (!fixtureZip)
      throw new Error('No fixture file. Set E2E_FIXTURE_ZIP env var.');
    await input.uploadFile(fixtureZip);
  },

  // ── Select (Dropdown) ───────────────────────────────────────────
  async select({ page }, action) {
    await waitForSPAStable(page);
    await page.waitForSelector(action.selector, {
      visible: true,
      timeout: 10000,
    });
    await page.select(action.selector, action.value);
  },

  // ── Scroll ──────────────────────────────────────────────────────
  async scroll_to({ page }, action) {
    await waitForSPAStable(page);
    const el = await retryUntilFound(() => page.$(action.selector), 10000);
    if (!el)
      throw new Error(`Element "${action.selector}" not found to scroll to`);
    await el.evaluate(e =>
      e.scrollIntoView({ behavior: 'smooth', block: 'center' }),
    );
  },

  async scroll_page({ page }, action) {
    await page.evaluate(
      (x, y) => window.scrollBy(x, y),
      action.x || 0,
      action.y || 0,
    );
  },

  // ── Drag and Drop ───────────────────────────────────────────────
  async drag_and_drop({ page }, action) {
    await waitForSPAStable(page);
    const srcEl = await retryUntilFound(() => page.$(action.source), 10000);
    if (!srcEl) throw new Error(`Drag source "${action.source}" not found`);
    const tgtEl = await retryUntilFound(() => page.$(action.target), 10000);
    if (!tgtEl) throw new Error(`Drop target "${action.target}" not found`);

    const srcBox = await srcEl.boundingBox();
    const tgtBox = await tgtEl.boundingBox();
    if (!srcBox || !tgtBox)
      throw new Error('Cannot get bounding box for drag elements');

    await page.mouse.move(
      srcBox.x + srcBox.width / 2,
      srcBox.y + srcBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      tgtBox.x + tgtBox.width / 2,
      tgtBox.y + tgtBox.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();
  },

  // ── Viewport ────────────────────────────────────────────────────
  async set_viewport({ page }, action) {
    await page.setViewport({
      width: action.width || 1280,
      height: action.height || 720,
    });
  },

  // ── Wait ────────────────────────────────────────────────────────
  async wait(_ctx, action) {
    await new Promise(r => setTimeout(r, action.duration || 1000));
  },

  async wait_for_text({ page }, action) {
    const timeout = action.timeout || 60000;
    await page.waitForFunction(
      text => document.body.innerText.includes(text),
      { timeout, polling: 300 },
      action.text,
    );
  },

  async wait_for_element({ page }, action) {
    await page.waitForSelector(action.selector, {
      visible: true,
      timeout: action.timeout || 15000,
    });
  },

  async wait_for_selector({ page }, action) {
    const visible = action.visible !== undefined ? action.visible : true;
    await page.waitForSelector(action.selector, {
      visible,
      hidden: !visible,
      timeout: action.timeout || 15000,
    });
  },

  async wait_for_navigation({ page }, action) {
    // Guard: navigation may have already completed before this step ran
    // (e.g. click on step N triggers nav, this is step N+1).
    // Use a short timeout and fall through silently on timeout.
    try {
      await page.waitForNavigation({
        waitUntil: action.waitUntil || 'networkidle0',
        timeout: action.timeout || 5000,
      });
    } catch {
      // Navigation already completed — fall through
    }
    await waitForSPAStable(page);
  },

  // ── Modal ───────────────────────────────────────────────────────
  async confirm_modal({ page }) {
    // Wait for modal to animate in
    const modalBtn = await retryUntilFound(async () => {
      const handle = await page.evaluateHandle(() => {
        const modals = document.querySelectorAll(
          '[class*="modal"], [class*="Modal"], [role="dialog"]',
        );
        for (const modal of modals) {
          if (modal.offsetParent === null) continue;
          const btns = modal.querySelectorAll('button');
          for (const b of btns) {
            const text = b.textContent.trim().toLowerCase();
            if (
              [
                'activate',
                'deactivate',
                'install',
                'uninstall',
                'delete',
                'confirm',
                'yes',
                'ok',
                'save',
                'submit',
              ].some(k => text.includes(k))
            ) {
              return b;
            }
          }
          const primary = modal.querySelector('button[class*="primary"]');
          if (primary) return primary;
        }
        return null;
      });
      return handle.asElement();
    }, 10000);

    if (!modalBtn) throw new Error('Modal confirm button not found');
    await modalBtn.click();
  },

  // ── Assertions ──────────────────────────────────────────────────
  async assert_url({ page }, action) {
    await waitForSPAStable(page);

    const expectedPath = action.url.startsWith('http')
      ? new URL(action.url).pathname
      : action.url;

    try {
      await retryUntilFound(async () => {
        const currentPath = new URL(page.url()).pathname;
        return currentPath === expectedPath ? true : null;
      }, 10000);
    } catch {
      const currentPath = new URL(page.url()).pathname;
      throw new Error(
        `Expected URL pathname to be "${expectedPath}", but got "${currentPath}"`,
      );
    }
  },

  async assert_visible({ page }, action) {
    await waitForSPAStable(page);

    if (action.selector && action.text) {
      const el = await retryUntilFound(async () => {
        const found = await page.$$(action.selector);
        for (const e of found) {
          const visible = await e.evaluate(node => node.offsetParent !== null);
          if (!visible) continue;
          const text = await e.evaluate(
            node => node.innerText || node.textContent,
          );
          if (text.includes(action.text)) return e;
        }
        return null;
      }, 10000);
      if (!el)
        throw new Error(
          `Element "${action.selector}" with text "${action.text}" not visible`,
        );
      return;
    }

    if (action.text) {
      try {
        await retryUntilFound(async () => {
          const found = await page.evaluate(
            text => document.body.innerText.includes(text),
            action.text,
          );
          return found ? true : null;
        }, 10000);
      } catch {
        throw new Error(`Text "${action.text}" not visible on page`);
      }
      return;
    }

    if (action.selector) {
      const el = await retryUntilFound(async () => {
        const found = await page.$(action.selector);
        if (!found) return null;
        const visible = await found.evaluate(e => e.offsetParent !== null);
        return visible ? found : null;
      }, 10000);
      if (!el) throw new Error(`Element "${action.selector}" not visible`);
    }
  },

  async assert_not_visible({ page }, action) {
    // For negative assertions, wait a bit for SPA to settle,
    // then verify the element is truly gone
    await waitForSPAStable(page);

    if (action.text) {
      const found = await page.evaluate(
        text => document.body.innerText.includes(text),
        action.text,
      );
      if (found) {
        throw new Error(
          `Text "${action.text}" IS visible (expected not visible)`,
        );
      }
      return;
    }
    if (action.selector) {
      const el = await page.$(action.selector);
      if (el) {
        const visible = await el.evaluate(e => e.offsetParent !== null);
        if (visible) throw new Error(`Element "${action.selector}" IS visible`);
      }
    }
  },

  async assert_checked({ page }, action) {
    await waitForSPAStable(page);

    let checkbox;
    if (action.container) {
      checkbox = await findWithinContainer(
        page,
        action.container.selector,
        action.container.hasText,
        action.selector || 'input[type="checkbox"]',
      );
    } else {
      checkbox = await retryUntilFound(
        () => page.$(action.selector || 'input[type="checkbox"]'),
        10000,
      );
    }

    if (!checkbox) throw new Error('Checkbox not found');
    const checked = await checkbox.evaluate(el => el.checked);
    if (action.checked && !checked) {
      throw new Error('Checkbox NOT checked (expected checked)');
    }
    if (!action.checked && checked) {
      throw new Error('Checkbox IS checked (expected unchecked)');
    }
  },

  async assert_title({ page }, action) {
    await waitForSPAStable(page);
    const title = await page.title();
    if (action.equals !== undefined && title !== action.equals) {
      throw new Error(`Expected page title "${action.equals}", got "${title}"`);
    }
    if (action.contains !== undefined && !title.includes(action.contains)) {
      throw new Error(
        `Expected page title to contain "${action.contains}", got "${title}"`,
      );
    }
  },

  async assert_enabled({ page }, action) {
    await waitForSPAStable(page);
    const expectEnabled = action.enabled !== undefined ? action.enabled : true;

    try {
      await retryUntilFound(async () => {
        const el = await page.$(action.selector);
        if (!el) return null;
        const disabled = await el.evaluate(e => e.disabled);
        // Return truthy only when state matches expectation
        return expectEnabled ? !disabled : disabled ? true : null;
      }, 10000);
    } catch {
      throw new Error(
        `Element "${action.selector}" is ${expectEnabled ? 'disabled' : 'enabled'} (expected ${expectEnabled ? 'enabled' : 'disabled'})`,
      );
    }
  },

  async assert_attribute({ page }, action) {
    await waitForSPAStable(page);
    const el = await retryUntilFound(() => page.$(action.selector), 10000);
    if (!el) throw new Error(`Element "${action.selector}" not found`);
    const value = await el.evaluate(
      (e, attr) => e.getAttribute(attr),
      action.attribute,
    );

    // Check exists first — it's the most fundamental assertion
    if (action.exists !== undefined) {
      if (action.exists && value === null) {
        throw new Error(`Expected attribute "${action.attribute}" to exist`);
      }
      if (!action.exists && value !== null) {
        throw new Error(
          `Expected attribute "${action.attribute}" to NOT exist`,
        );
      }
      return;
    }

    if (action.equals !== undefined && value !== action.equals) {
      throw new Error(
        `Expected attribute "${action.attribute}" = "${action.equals}", got "${value}"`,
      );
    }
    if (
      action.contains !== undefined &&
      (!value || !value.includes(action.contains))
    ) {
      throw new Error(
        `Expected attribute "${action.attribute}" to contain "${action.contains}", got "${value}"`,
      );
    }
  },

  async assert_count({ page }, action) {
    await waitForSPAStable(page);

    try {
      await retryUntilFound(async () => {
        const elements = await page.$$(action.selector);
        return elements.length === action.count ? true : null;
      }, 10000);
    } catch {
      const actual = (await page.$$(action.selector)).length;
      throw new Error(
        `Expected ${action.count} elements matching "${action.selector}", found ${actual}`,
      );
    }
  },

  // ── Evaluate (run JS in page context) ───────────────────────────
  async evaluate({ page, apiState }, action) {
    await waitForSPAStable(page);
    // Wrap in arrow function to safely handle both expressions and statements
    const result = await page.evaluate(
      `(()=>{try{return(${action.script})}catch(e){return e.message}})()`,
    );
    if (action.as) {
      apiState.variables[action.as] =
        typeof result === 'object' && result !== null
          ? JSON.stringify(result)
          : String(result || '');
    }
  },

  // ── Screenshot ──────────────────────────────────────────────────
  async screenshot({ page }, action) {
    await waitForSPAStable(page);
    if (action.path) {
      await page.screenshot({ path: action.path, fullPage: true });
    }
  },

  // ── API Actions (no browser required) ────────────────────────────

  async api_request({ apiState, baseUrl }, action) {
    const method = (action.method || 'GET').toUpperCase();
    const url = action.url.startsWith('http')
      ? action.url
      : `${baseUrl}${action.url}`;

    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...apiState.headers,
      ...(action.headers || {}),
    };

    // Interpolate stored variables in URL, body, and headers
    const interpolate = str => interpolateVars(str, apiState.variables);
    const finalUrl = interpolate(url);

    let body = null;
    if (action.body) {
      const bodyStr = JSON.stringify(action.body);
      body = interpolate(bodyStr);
    }

    // Interpolate header values
    for (const [key, val] of Object.entries(headers)) {
      if (typeof val === 'string') headers[key] = interpolate(val);
    }

    const response = await apiRequest(finalUrl, {
      method,
      headers,
      body,
    });

    // Store the response for subsequent assertions
    apiState.lastResponse = response;
  },

  async assert_status({ apiState }, action) {
    const { lastResponse } = apiState;
    if (!lastResponse) {
      throw new Error('No API response — call api_request first');
    }

    const { expected } = action;
    if (lastResponse.statusCode !== expected) {
      throw new Error(
        `Expected status ${expected}, got ${lastResponse.statusCode}: ${lastResponse.body.slice(0, 200)}`,
      );
    }
  },

  async assert_body({ apiState }, action) {
    const { lastResponse } = apiState;
    if (!lastResponse) {
      throw new Error('No API response — call api_request first');
    }

    let data;
    try {
      if (!lastResponse.parsedBody) {
        lastResponse.parsedBody = JSON.parse(lastResponse.body);
      }
      data = lastResponse.parsedBody;
    } catch {
      throw new Error(
        `Response body is not valid JSON: ${lastResponse.body.slice(0, 200)}`,
      );
    }

    const value = getNestedValue(data, action.path);

    if (action.exists !== undefined) {
      if (action.exists && value === undefined) {
        throw new Error(`Expected "${action.path}" to exist in response`);
      }
      if (!action.exists && value !== undefined) {
        throw new Error(`Expected "${action.path}" to NOT exist in response`);
      }
      return;
    }

    if (action.equals !== undefined) {
      const expected = interpolateVars(
        String(action.equals),
        apiState.variables,
      );
      if (String(value) !== expected) {
        throw new Error(
          `Expected "${action.path}" = "${expected}", got "${value}"`,
        );
      }
      return;
    }

    if (action.contains !== undefined) {
      const expected = interpolateVars(
        String(action.contains),
        apiState.variables,
      );
      if (!String(value).includes(expected)) {
        throw new Error(
          `Expected "${action.path}" to contain "${expected}", got "${value}"`,
        );
      }
      return;
    }

    if (action.not_equals !== undefined) {
      const unexpected = interpolateVars(
        String(action.not_equals),
        apiState.variables,
      );
      if (String(value) === unexpected) {
        throw new Error(
          `Expected "${action.path}" to NOT equal "${unexpected}", but it does`,
        );
      }
      return;
    }

    if (action.length !== undefined) {
      if (!Array.isArray(value)) {
        throw new Error(
          `Expected "${action.path}" to be an array, got ${typeof value}`,
        );
      }
      if (value.length !== action.length) {
        throw new Error(
          `Expected "${action.path}" array length ${action.length}, got ${value.length}`,
        );
      }
    }
  },

  async assert_header({ apiState }, action) {
    const { lastResponse } = apiState;
    if (!lastResponse) {
      throw new Error('No API response — call api_request first');
    }

    const headerName = action.name.toLowerCase();
    const actual = lastResponse.headers[headerName];

    if (action.exists !== undefined) {
      if (action.exists && !actual) {
        throw new Error(`Expected header "${action.name}" to exist`);
      }
      if (!action.exists && actual) {
        throw new Error(`Expected header "${action.name}" to NOT exist`);
      }
      return;
    }

    if (action.contains !== undefined) {
      if (!actual || !actual.includes(action.contains)) {
        throw new Error(
          `Expected header "${action.name}" to contain "${action.contains}", got "${actual}"`,
        );
      }
    }
  },

  async store_value({ page, apiState }, action) {
    let source;

    if (action.value !== undefined) {
      // 1. Static custom string / interpolation
      source = interpolateVars(action.value, apiState.variables);
    } else if (action.selector) {
      // 2. Browser DOM text scraping
      if (!page)
        throw new Error('Cannot store from DOM: No browser page active');
      await waitForSPAStable(page);
      const el = await retryUntilFound(() => page.$(action.selector), 10000);
      if (!el)
        throw new Error(
          `Element "${action.selector}" not found to store value`,
        );

      if (action.property) {
        source = await el.evaluate((n, prop) => n[prop], action.property);
      } else {
        source = await el.evaluate(n => n.innerText || n.textContent);
      }
    } else if (action.from) {
      // 3. API Response parsing
      const { lastResponse } = apiState;
      if (!lastResponse) {
        throw new Error(
          `Cannot store from response: call api_request first before fetching "${action.from}"`,
        );
      }

      if (action.from.startsWith('response.header.')) {
        const hdrName = action.from
          .replace('response.header.', '')
          .toLowerCase();
        source = lastResponse.headers[hdrName];
      } else if (action.from.startsWith('response.status')) {
        source = lastResponse.statusCode;
      } else {
        const bodyPath = action.from.replace(/^response\./, '');
        let data;
        try {
          if (!lastResponse.parsedBody) {
            lastResponse.parsedBody = JSON.parse(lastResponse.body);
          }
          data = lastResponse.parsedBody;
        } catch {
          throw new Error('Response body is not valid JSON');
        }
        source = getNestedValue(data, bodyPath);
      }
    } else {
      throw new Error(
        'store_value requires "value", "selector", or "from" property',
      );
    }

    if (source === undefined) {
      throw new Error(
        `Cannot store variable "${action.as}" — source is undefined`,
      );
    }

    // Safely serialize objects instead of outputting '[object Object]'
    apiState.variables[action.as] =
      typeof source === 'object' && source !== null
        ? JSON.stringify(source)
        : String(source).trim();
  },

  async set_header({ apiState }, action) {
    const value = interpolateVars(action.value, apiState.variables);
    apiState.headers[action.name] = value;
  },
};

/**
 * Execute a structured action from the LLM interpreter.
 *
 * @param {object} action - JSON action from LLM { action: string, ...params }
 * @param {object} context - { page, baseUrl, fixtureZip }
 */
async function executeAction(action, context) {
  const handler = ACTIONS[action.action];
  if (!handler) {
    console.log(`    ⚠ Unknown action type: "${action.action}" — skipped`);
    return { success: true, skipped: true };
  }

  try {
    await handler(context, action);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ── API Helpers ───────────────────────────────────────────────────

/**
 * Create a fresh API state object for API/system tests.
 * Holds persistent headers, stored variables, and the last response.
 *
 * @param {object} [prerequisites] Test prerequisites (email, password, etc.)
 *   Seeded into variables so {{email}} interpolation works in request bodies.
 */
function createAPIState(prerequisites) {
  return {
    headers: {},
    variables: { ...(prerequisites || {}) },
    lastResponse: null,
  };
}

/**
 * Make an HTTP request and return { statusCode, headers, body }.
 */
function apiRequest(url, options) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const reqOpts = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 30000,
    };

    const req = lib.request(parsedUrl, reqOpts, res => {
      let body = '';
      res.on('data', chunk => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('API request timeout'));
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * Get a nested value from an object using jsonpath.
 * e.g., getNestedValue({ user: { email: 'a' } }, 'user.email') → 'a'
 */
function getNestedValue(obj, path) {
  if (!path) return obj;

  let jpPath = path;
  if (!jpPath.startsWith('$')) {
    // Auto-prefix root designator if omitted
    jpPath = jpPath.startsWith('.') ? '$' + jpPath : '$.' + jpPath;
  }

  let val;
  try {
    val = jp.value(obj, jpPath);
  } catch (e) {
    // If parse fails
    val = undefined;
  }

  // Auto-unwrap generic API envelopes if direct path misses
  if (val === undefined && obj && typeof obj === 'object') {
    const rawPath = path.startsWith('$.') ? path.slice(2) : path;
    for (const key of Object.keys(obj)) {
      if (
        typeof obj[key] === 'object' &&
        obj[key] !== null &&
        !Array.isArray(obj[key])
      ) {
        const deepVal = getNestedValue(obj[key], rawPath);
        if (deepVal !== undefined) return deepVal;
      }
    }
  }

  return val;
}

/**
 * Interpolate {{variableName}} placeholders in a string.
 */
function interpolateVars(str, variables) {
  if (!str || typeof str !== 'string') return str;
  return str.replace(/\{\{([\w-]+)\}\}/g, (match, name) => {
    if (variables[name] !== undefined) return variables[name];
    return match; // leave unresolved placeholders as-is
  });
}

module.exports = {
  executeAction,
  createAPIState,
  waitForSPAStable,
  waitForRouteReady,
  installSPAInstrumentation,
  collectStabilitySignals,
};
