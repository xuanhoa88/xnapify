---
name: puppeteer-automation
description: Best practices for writing Puppeteer scripts and tests, ensuring consistency with the project's E2E framework (SPA stability, retry patterns, pseudo-selectors, and stealth).
allowed-tools: Browser, Read, Write, Terminal
version: 2.0
---

# Puppeteer Automation Skill

This skill enforces consistency between custom Puppeteer scripts and the E2E test runner infrastructure in `tools/e2e`. It documents the actual patterns used by the executor, the SPA stability engine, the compile-then-execute architecture, and advanced Puppeteer capabilities.

## E2E System Architecture

The framework has 7 modules. Understanding their roles prevents agents from duplicating logic or writing inconsistent code.

```
runner.js          ← CLI orchestration, parallel modules, test lifecycle
  ├─ parser.js     ← Parses test.md YAML front-matter + markdown steps
  ├─ compiler.js   ← LLM compile: test.md → script.json (cached)
  │   └─ llmInterpreter.js  ← Multi-provider LLM calls + SYSTEM_PROMPT
  ├─ executor.js   ← Action handlers + SPA stability engine
  ├─ browser.js    ← Puppeteer launch, page factory, cleanup
  └─ reporter.js   ← HTML/JSON report generation
```

**Flow**: `test.md` → (LLM compile) → `script.json` → (executor runs each action) → report.

---

## 1. Element Selection: Executor Patterns vs Standalone Scripts

### Inside the E2E Executor

The executor does **NOT** use `page.locator()`. It uses a custom retry-and-stabilize layer built on the legacy Puppeteer API. All action handlers follow this pattern:

```javascript
// 1. Wait for SPA to settle (network, DOM, animations, React, loading UI)
await waitForSPAStable(page);

// 2. Find element with polling retry (handles async SPA rendering)
const el = await retryUntilFound(() => page.$(selector), 10000);

// 3. Interact
await el.click();
```

Key functions (exported from `executor.js`):

| Function                                                      | Purpose                                            |
| ------------------------------------------------------------- | -------------------------------------------------- |
| `waitForSPAStable(page, opts)`                                | Wait until all 5 stability signals are quiet       |
| `waitForRouteReady(page, timeout)`                            | Wait for navigation + SPA settle (500ms window)    |
| `retryUntilFound(finder, timeout, interval)`                  | Poll a finder function until it returns truthy     |
| `findByText(page, text, selector, timeout)`                   | Find visible element by text content with retry    |
| `findWithinContainer(page, containerSel, hasText, targetSel)` | Scoped element search within a container           |
| `installSPAInstrumentation(page)`                             | Inject network/DOM tracking into page (idempotent) |
| `collectStabilitySignals(page, opts)`                         | Diagnostic snapshot of all 5 stability signals     |

**When modifying or extending `executor.js`, always follow this pattern.** Do not introduce `page.locator()` calls into the executor — it would create an inconsistent hybrid.

### Standalone Puppeteer Scripts (Outside Executor)

For **new standalone scripts** (scrapers, one-off automation, manual test helpers), prefer the modern Locator API. Locators automatically wait for visibility and actionability:

```javascript
// ✅ Standalone scripts: use page.locator()
await page.locator('button.submit').click();
await page.locator('::-p-text(Upload Extension)').click();
await page.locator("input[name='email']").fill('admin@example.com');
```

**Do NOT** mix both patterns in the same file.

---

## 2. Pseudo-Selectors for Text and Accessibility

Puppeteer supports pseudo-selectors for targeting user-visible content. The `SYSTEM_PROMPT` in `llmInterpreter.js` guides the LLM to prefer these over brittle CSS class selectors.

```javascript
// Text content
await page.locator('::-p-text(Upload Extension)').click();

// ARIA role
await page.locator('::-p-aria(Submit[role="button"])').click();
```

These work with both `page.locator()` and `page.waitForSelector()`.

---

## 3. Scope Chaining & Container Search

For elements inside specific containers (cards, rows, modals), the executor has `findWithinContainer()` and the LLM prompt defines `click_within`:

```javascript
// Executor pattern (used by click_within handler):
const el = await findWithinContainer(
  page,
  "[class*='root']", // container selector
  'sample-extension', // container must contain this text
  "input[type='checkbox']", // target within container
);
await el.click();
```

In standalone scripts, use locator chaining:

```javascript
await page
  .locator("[class*='root']")
  .filter({ hasText: 'sample-extension' })
  .locator("input[type='checkbox']")
  .click();
```

---

## 4. Fill vs Type

Follow the behavioral definitions from the executor:

- **`fill`**: Atomically clear + set value. Uses `Cmd/Ctrl+A` then types with `delay: 0`. Use when the step says "enter", "set", "put".
- **`type`**: Simulates keystrokes one by one with `delay: 30`. Use only when you need per-character events (autocomplete, `keyup` listeners).
- **`clear`**: Select-all + Backspace. Clears without setting a new value.

```javascript
// Executor's fill handler (executor.js lines 744-760):
await el.click();
const selectAll = process.platform === 'darwin' ? 'Meta' : 'Control';
await page.keyboard.down(selectAll);
await page.keyboard.press('a');
await page.keyboard.up(selectAll);
await el.type(value, { delay: 0 });
```

---

## 5. SPA Stability Engine (Deep Dive)

The executor's stability engine (`executor.js` lines 27–423) is the core innovation. It tracks 5 independent signals:

### Signal 1: Network

- Monkey-patches `fetch()` and `XMLHttpRequest` to count in-flight requests.
- Stable when: `pendingRequests === 0` AND quiet for `settleWindow` ms.

### Signal 2: DOM Mutations

- `MutationObserver` on `document.body` tracking `childList`, `attributes`.
- Filters out trivial mutations (cursor blinks, focus rings).
- Stable when: no meaningful mutations for `settleWindow` ms.

### Signal 3: CSS Animations

- Iterates visible elements, checks `el.getAnimations()`.
- Skips infinite animations (decorative) and very short utility animations (<100ms).
- Stable when: `runningAnimations === 0`.

### Signal 4: Loading UI

- Scans for loading indicators: `[class*="skeleton"]`, `[class*="spinner"]`, `[role="progressbar"]`, `[aria-busy="true"]`.
- Checks for overlays/backdrops blocking interaction.
- Checks root-level loading classes on `body`, `#app`, `#root`.
- Stable when: no visible loaders, no overlay, no loading class.

### Signal 5: React Internals

- Inspects `__reactFiber` on root element for pending context updates.
- Checks for visible React error boundaries.
- Stable when: not rendering.

### Configuration

```javascript
const SPA_DEFAULTS = {
  timeout: 15000, // Max total wait
  settleWindow: 300, // All signals must be quiet for this long
  pollInterval: 100, // Polling frequency
  debug: process.env.E2E_DEBUG === 'true',
};
```

Set `E2E_DEBUG=true` to see real-time stability diagnostics in console.

---

## 6. Verification & Assertions

The executor does NOT use any test framework (`expect`, `assert`). It throws `Error` on failure:

```javascript
// ✅ Executor pattern — throw on mismatch
const checked = await checkbox.evaluate(el => el.checked);
if (action.checked && !checked) {
  throw new Error('Checkbox NOT checked (expected checked)');
}
```

Available assertion handlers in executor:

| Action               | What It Checks                                                                 |
| -------------------- | ------------------------------------------------------------------------------ |
| `assert_url`         | Current URL pathname matches expected                                          |
| `assert_visible`     | Text or element is visible on page                                             |
| `assert_not_visible` | Text or element is NOT visible                                                 |
| `assert_checked`     | Checkbox checked state (supports container scoping)                            |
| `assert_title`       | Page title `equals` or `contains`                                              |
| `assert_enabled`     | Element enabled/disabled state                                                 |
| `assert_attribute`   | Element attribute `equals`, `contains`, or `exists`                            |
| `assert_count`       | Number of matching elements `=== count`                                        |
| `assert_status`      | API response status code                                                       |
| `assert_body`        | API response body path: `exists`, `equals`, `contains`, `not_equals`, `length` |
| `assert_header`      | API response header: `exists`, `contains`                                      |

---

## 7. API Action Handlers

The executor supports full API testing without a browser. These handlers operate on an `apiState` object:

```javascript
const apiState = createAPIState(prerequisites);
// apiState = { headers: {}, variables: { email, password, ... }, lastResponse: null }
```

| Action          | Purpose                                                          |
| --------------- | ---------------------------------------------------------------- |
| `api_request`   | Make HTTP request (GET/POST/PUT/DELETE), stores response         |
| `assert_status` | Check `lastResponse.statusCode`                                  |
| `assert_body`   | Check response body via JSONPath (`getNestedValue`)              |
| `assert_header` | Check response headers                                           |
| `store_value`   | Extract value from response/DOM/static into `apiState.variables` |
| `set_header`    | Set persistent header for subsequent requests                    |

### Variable Interpolation

All actions support `{{variableName}}` interpolation via `interpolateVars()`:

```javascript
// In test step: "Send POST /api/auth/login with email and password"
// LLM generates:
{ "action": "api_request", "method": "POST", "url": "/api/auth/login",
  "body": { "email": "{{email}}", "password": "{{password}}" } }
```

Variables come from: prerequisites (YAML front-matter), `store_value` actions, or env vars.

---

## 8. Browser Launch & Platform Behavior

The `browser.js` module handles platform-specific quirks:

| Platform | Behavior                                                                                                                                                    |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| macOS    | Uses `channel: 'chrome'` (system Chrome) to avoid bundled Chromium crashes (`UniversalExceptionRaise`). Falls back to bundled if system Chrome unavailable. |
| Linux    | Adds `--no-zygote` flag for sandbox compatibility                                                                                                           |
| All      | `--no-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`                                                                                                  |

### Test Isolation

Each test case gets an **incognito browser context** via `createBrowserContext()`. This ensures:

- Separate cookie jars per test
- No localStorage/sessionStorage leakage
- Independent service worker registrations

```javascript
// browser.js createPage():
const context = await browser.createBrowserContext();
const page = await context.newPage();
page.setDefaultTimeout(30000);
```

### WebSocket Resilience

The runner handles `disconnected` events and `ECONNRESET` errors gracefully. During slow LLM compilation, the browser is proactively closed to prevent idle WebSocket timeouts, then re-launched when execution begins.

---

## 9. Compile-Then-Execute Flow

Test cases follow a two-phase lifecycle:

### Phase 1: Compile (LLM)

```
test.md → parser.js → { steps[], prerequisites, expectedResults }
        → compiler.js → LLM interpretStep() for each step
        → script.json + .test-hash (SHA256 of execution-critical sections)
```

The compiled `script.json` is cached. Recompilation triggers only when:

- `script.json` doesn't exist
- `.test-hash` doesn't match current `test.md` hash
- `--force` flag is passed

Old scripts are archived to `_scripts/{timestamp}.json` (max 5 kept).

### Phase 2: Execute

```
script.json → runner.js → executeAction() for each action
            → executor.js handlers → Puppeteer / HTTP
            → reporter.js → results + screenshots
```

Failed steps trigger **auto-recompile**: the LLM reinterprets the step with the error message as context, and the new action is retried once.

---

## 10. Navigation & Wait Strategies

### Within the executor (automatic)

Every navigation action calls `waitForRouteReady()` which:

1. Waits for `networkidle2` (5s timeout, silent on timeout)
2. Calls `waitForSPAStable()` with 500ms settle window

### In standalone scripts

```javascript
// Full page navigation
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }),
  page.locator('a.nav-link').click(),
]);

// Wait for specific DOM condition
await page.waitForFunction(
  'document.querySelector(".count").innerText === "5"',
);

// Wait for specific API response
const response = await page.waitForResponse(
  resp => resp.url().includes('/api/data') && resp.status() === 200,
);
```

### Wait Until Options

- `load` — fires after window `load` event
- `domcontentloaded` — fires after DOMContentLoaded
- `networkidle0` — no network connections for 500ms
- `networkidle2` — max 2 network connections for 500ms

---

## 11. Network Interception & Mocking

Useful for simulating API responses locally or blocking heavy assets during speed testing.

```javascript
await page.setRequestInterception(true);

page.on('request', request => {
  if (request.resourceType() === 'image') {
    request.abort();
    return;
  }
  if (request.url().includes('/api/data')) {
    request.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    });
  } else {
    request.continue();
  }
});
```

### Monitoring Network Traffic

```javascript
page.on('response', async response => {
  if (response.url().includes('/api/')) {
    console.log(`${response.status()} ${response.url()}`);
  }
});

page.on('requestfailed', request => {
  console.log('Failed:', request.failure().errorText, request.url());
});
```

---

## 12. Screenshot & PDF Generation

Ensure UI is fully loaded before capturing. Within the executor, `waitForSPAStable()` is called automatically. In standalone scripts, wait explicitly.

```javascript
// Full page
await page.screenshot({ path: 'screenshot.png', fullPage: true });

// Element screenshot
const el = await page.$('.chart');
await el.screenshot({ path: 'chart.png' });

// Screenshot to buffer (no file)
const buffer = await page.screenshot({ encoding: 'binary' });

// PDF
await page.pdf({ path: 'page.pdf', format: 'A4', printBackground: true });
```

---

## 13. Quick Evaluation & Extraction Reference

| Task             | Code                                                                              |
| ---------------- | --------------------------------------------------------------------------------- |
| Evaluate JS      | `await page.evaluate(() => document.title)`                                       |
| Evaluate w/ Args | `await page.evaluate((sel) => document.querySelector(sel).textContent, '.el')`    |
| Get Property     | `await page.$eval('#input', el => el.value)`                                      |
| Get Multiple     | `await page.$$eval('.items', els => els.map(e => e.textContent))`                 |
| Set Cookie       | `await page.setCookie({ name: 'token', value: 'abc', domain: 'localhost' })`      |
| Get Cookies      | `const cookies = await page.cookies()`                                            |
| Clear Storage    | `await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); })`    |
| Emulate Device   | `await page.emulate(puppeteer.devices['iPhone 13 Pro'])`                          |
| Geolocation      | `await page.setGeolocation({ latitude: 37.77, longitude: -122.41 })`              |
| Set Timezone     | `await page.emulateTimezone('America/New_York')`                                  |
| Permissions      | `await browser.defaultBrowserContext().overridePermissions(url, ['geolocation'])` |

---

## 14. Execution Efficiency & Resource Management

- **Headless Execution**: Production/CI uses `headless: 'new'`. Use `--headed` flag or `E2E_HEADLESS=false` to show the browser during development.
- **Resource Cleanup**: Always use `try { ... } finally { await closeBrowser(browser); }`. The runner handles this automatically.
- **Session Reusing**: For multi-step flows, the executor's `apiState` stores headers and tokens across actions within a test case. For browser tests, each test case gets a fresh incognito context.
- **Visual Milestones**: The runner automatically captures per-step screenshots to the results directory. Use `action.path` in `screenshot` actions for custom captures.
- **Deferred Browser Launch**: Browser is launched lazily, only when a UI/system test is about to execute. During slow LLM compilation, no browser is running.

---

## 15. Stealth & Anti-Bot Evasion

For automating external targets or scraping public data outside of local E2E control:

- **Stealth Module**: Use `puppeteer-extra` + `puppeteer-extra-plugin-stealth` to bypass bot detection (Cloudflare, etc.).
- **Human-like Interaction**: Add deliberate delays to keystrokes (`delay: 100`) and avoid instant node transitions.
- **Fingerprint Randomization**: Rotate `User-Agent` headers and viewport properties for high-volume extractions.
- **Ethical Scrape Limits**: Implement throttle delays, respect `robots.txt`, stop on hard CAPTCHA blocks.

---

## 16. Handling Dialogs & Alerts

Puppeteer requires explicit listeners for browser dialogs. Without them, the script hangs.

```javascript
page.on('dialog', async dialog => {
  console.log(`Dialog: ${dialog.type()} — ${dialog.message()}`);
  await dialog.accept(); // or dialog.dismiss()
});
```

The executor has a `confirm_modal` handler that detects modal dialogs by searching for visible `[role="dialog"]` or `[class*="modal"]` elements and clicking the primary action button (matching keywords: activate, confirm, delete, yes, ok, save, submit).

---

## 17. Advanced Browser Patterns (Standalone Scripts Only)

These patterns are NOT part of the E2E executor. Use them only in standalone Puppeteer scripts.

### Working with Iframes

```javascript
const frame = page.frames().find(f => f.url().includes('checkout-frame'));
if (frame) {
  await frame.type('#card-number', '4242424242424242');
  await frame.click('button.pay');
}
```

### Multi-Tab & Target Management

```javascript
const [newPage] = await Promise.all([
  new Promise(resolve => browser.once('targetcreated', t => resolve(t.page()))),
  page.click('a[target="_blank"]'),
]);
await newPage.bringToFront();
```

### Infinite Scroll

```javascript
await page.evaluate(async () => {
  await new Promise(resolve => {
    let totalHeight = 0,
      distance = 100;
    const timer = setInterval(() => {
      window.scrollBy(0, distance);
      totalHeight += distance;
      if (totalHeight >= document.body.scrollHeight) {
        clearInterval(timer);
        resolve();
      }
    }, 100);
  });
});
```

### Download Management (via CDP)

```javascript
const client = await page.createCDPSession();
await client.send('Page.setDownloadBehavior', {
  behavior: 'allow',
  downloadPath: '/absolute/path/to/downloads',
});
await page.click('a.download-link');
```

### Performance Throttling (via CDP)

```javascript
const client = await page.createCDPSession();
// CPU throttling (4x slowdown)
await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
// Network throttling (Slow 3G)
await page.emulateNetworkConditions(puppeteer.networkConditions['Slow 3G']);
```

---

## 18. Environment Variables Reference

### Application

| Variable            | Default | Purpose             |
| ------------------- | ------- | ------------------- |
| `XNAPIFY_PORT`      | `1337`  | App port (primary)  |
| `E2E_PORT` / `PORT` | —       | App port (fallback) |

### Browser

| Variable          | Default | Purpose                                      |
| ----------------- | ------- | -------------------------------------------- |
| `E2E_HEADLESS`    | `true`  | Set `false` to show browser                  |
| `E2E_FIXTURE_ZIP` | —       | Path to test extension .zip for upload tests |
| `E2E_DEBUG`       | `false` | Enable SPA stability diagnostics             |

### Credentials

| Variable       | Default | Purpose                                             |
| -------------- | ------- | --------------------------------------------------- |
| `E2E_EMAIL`    | —       | Login email (fallback; prefer YAML front-matter)    |
| `E2E_PASSWORD` | —       | Login password (fallback; prefer YAML front-matter) |

### LLM Configuration

| Variable                | Default        | Purpose                                                                       |
| ----------------------- | -------------- | ----------------------------------------------------------------------------- |
| `E2E_LLM_PROVIDER`      | `auto`         | `auto`, `stdin`, `openai`, `anthropic`, `google`, `ollama`, `azure`, `custom` |
| `E2E_LLM_API_KEY`       | —              | Override auto-detected API key                                                |
| `E2E_LLM_MODEL`         | (per-provider) | Model name override                                                           |
| `E2E_LLM_BASE_URL`      | (per-provider) | Base URL override                                                             |
| `E2E_LLM_TIMEOUT`       | `120000`       | LLM request timeout (ms)                                                      |
| `E2E_GEMINI_API_KEY`    | —              | Google Gemini API key                                                         |
| `E2E_OPENAI_API_KEY`    | —              | OpenAI API key                                                                |
| `E2E_ANTHROPIC_API_KEY` | —              | Anthropic API key                                                             |
| `E2E_AZURE_API_KEY`     | —              | Azure OpenAI API key                                                          |
| `E2E_OLLAMA_HOST`       | `127.0.0.1`    | Ollama daemon host                                                            |
| `E2E_OLLAMA_PORT`       | `11434`        | Ollama daemon port                                                            |
| `E2E_OLLAMA_MODEL`      | `llama3.2`     | Ollama model name                                                             |

### Runner

| Variable              | Default | Purpose                                  |
| --------------------- | ------- | ---------------------------------------- |
| `E2E_VIA_TASK`        | —       | Guard: must be set by `npm run test:e2e` |
| `E2E_STARTUP_TIMEOUT` | `30000` | App readiness timeout (ms)               |

---

## 19. Troubleshooting & Debugging

- **SPA not settling**: Set `E2E_DEBUG=true` to see real-time stability signal diagnostics. Look for which signal (network, DOM, animations, loadingUI, react) is blocking.
- **Click intercepted by overlay**: The executor's `findByText()` walks up to the nearest interactive ancestor. In standalone scripts, use `el.evaluate(e => e.click())` to bypass overlay interception.
- **Slow Motion**: Add `slowMo: 100` to `puppeteer.launch()` options during development.
- **Console Monitoring**: Bridge browser console to your terminal:
  ```javascript
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));
  ```
- **Trace Analysis**: For performance issues, use Chrome tracing:
  ```javascript
  await page.tracing.start({ path: 'trace.json' });
  // ... actions ...
  await page.tracing.stop();
  // Load trace.json in chrome://tracing
  ```
- **macOS Chrome crashes**: The runner automatically uses system Chrome via `channel: 'chrome'`. If system Chrome is unavailable, it falls back to bundled Chromium.
- **WebSocket ECONNRESET**: The runner proactively closes browsers during slow LLM compilations. If you see this in standalone scripts, reduce idle time or add keep-alive pings.
- **LLM auto-recompile**: If a compiled step fails at runtime, the runner automatically recompiles that single step with the error message as LLM context, then retries once.
