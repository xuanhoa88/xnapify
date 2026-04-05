---
name: browser-testing
description: Comprehensive browser testing toolkit. Guides the AI agent on using both interactive browser automation and programmatic Puppeteer scripts for testing, interacting, and visually verifying the running app.
allowed-tools: Browser, Read, Write, Terminal
version: 3.0
---

# Browser Testing & Automation Skill

This skill enables comprehensive testing and debugging of the local `xnapify` web application. It supports two distinct operational modes:
1. **Programmatic Automation (Puppeteer)**: For writing repeatable custom test scripts, validating complex UI flows, programmatically capturing screenshots, or debugging application issues via Node.js scripts.
2. **Interactive AI Automation**: For exploratory testing, visual verification, and manually executing natural-language test cases via the AI agent's built-in browser automation tool.

> [!TIP]
> For executing the standardized **E2E lifecycle tests**, see the `/test-e2e` workflow. It reads `.md` test case files from each module's `e2e/` directory and executes them via the project's compiled runner (which natively uses Puppeteer).

---

## Port Discovery (MANDATORY — Do This First)

> [!CAUTION]
> The dev port is **NOT** 3000. It is configured via `XNAPIFY_PORT` in `.env` and can be **overridden** by environment-specific files (`.env.development`, `.env.local`, etc.).

**Resolution order:**

| Priority | Source | How |
|----------|--------|-----|
| 1 | User context | Check running terminal outputs for `localhost:XXXX` — this is always the **actual** running port |
| 2 | `.env` files | `grep XNAPIFY_PORT .env .env.* 2>/dev/null` — use the **last** match (env-specific files override base) |
| 3 | Default fallback | `1337` |

> 🔴 **NEVER guess or assume port 3000.** Always resolve from user context or `.env` files first.

---

## Handling Auth (Shared Rule)

If a page redirects to login (whether in Puppeteer or interactive mode):

1. Navigate to `/login`, fill admin credentials, submit.
2. Wait for redirect to the authenticated page.
3. If no credentials are known, **ask the user** — never guess passwords.
4. Reuse the browser session for subsequent actions (don't re-login each time).

---

## 🛠️ Mode 1: Programmatic Puppeteer Testing

Use this approach when you need to write and execute custom Node.js scripts to verify UI behavior, debug app issues programmatically, check responsive design, or scrape data.

### Core Capabilities
- **Browser Automation**: `goto` URLs, `click` buttons/links, `fill` form fields, select dropdowns, handle dialogs/alerts.
- **Verification**: Assert element presence, verify text content, check element visibility, validate URLs.
- **Debugging**: Capture screenshots (`page.screenshot`), view console logs, inspect network requests, debug failed automated interactions.

### Guidelines for Puppeteer Scripts
1. **Verify the app is running**: Ensure the local server is accessible at the resolved port before launching tests.
2. **Use explicit waits**: Wait for elements or navigation to complete (`waitForSelector`, `waitForNavigation`) before interacting.
3. **Capture screenshots on failure**: In catch blocks, take screenshots to help debug issues.
4. **Clean up resources**: Always `await browser.close()` when done to avoid zombie processes.
5. **Handle timeouts gracefully**: Set reasonable timeouts for network operations or lazy load elements.
6. **Test incrementally**: Start with simple interactions before building complex flows.
7. **Use selectors wisely**: Prefer `data-testid` or role-based selectors over brittle CSS classes where possible.

### Common Patterns & Usage Examples

**Pattern: Navigation & Verification**
```javascript
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${process.env.XNAPIFY_PORT || 1337}`);
const title = await page.title();
console.log('Page title:', title);
await browser.close();
```

**Pattern: Form Interaction**
```javascript
await page.waitForSelector('input[name="email"]');
await page.type('input[name="email"]', 'admin@example.com');
await page.type('input[name="password"]', 'password123');
await page.click('button[type="submit"]');
// Explicit wait for navigation context to update after submit
await page.waitForNavigation({ waitUntil: 'networkidle0' });
```

**Pattern: Wait for Element & Graceful Error Handling**
```javascript
try {
  // Wait for the specific element to be present and visible
  await page.waitForSelector('.success-toast', { visible: true, timeout: 5000 });
  const exists = await page.locator('.success-toast').count() > 0;
} catch (error) {
  await page.screenshot({ path: 'error-debug.png', fullPage: true });
  throw error;
}
```

**Pattern: Get Console Logs**
```javascript
page.on('console', msg => console.log('Browser log:', msg.text()));
```

*Limits: Native mobile apps are not supported. For React Native, use React Native Testing Library instead.*

---

## 🤖 Mode 2: Interactive AI Automation

Use your IDE's browser automation capability (e.g., `browser_subagent`, MCP browser tool) for visual UI checks, exploratory testing, or when running individual manual `test.md` test cases from the `/test-e2e` framework.

### Interactive Task Template

When using your agent browser tools, format your tasks carefully:
- **URL**: Full URL with the correct port, e.g. `http://localhost:1337/admin/extensions`.
- **Steps**: Numbered, specific actions.
- **Return condition**: What precisely to report back (e.g. text content, pass/fail status).
- **Recording/Screenshot**: Always capture visual evidence of the final state.

```text
Navigate to http://localhost:{PORT}/{path}.

Steps:
1. Wait for the page to fully load (look for [specific element]).
2. [Action] — click/type/scroll on [specific element].
3. [Verify] — confirm [expected outcome].
4. Take a screenshot of the result.

Return: Describe what you observed. Did [expected behavior] occur?
```

### Common Interactive Scenarios

**1. Visual Verification (CSS / Animation)**
*Flow:* Navigate -> Wait for data to load -> Click action -> IMMEDIATELY observe visual change (e.g., shimmer animation or loading spinner) -> Wait -> Verify final state.
*Return:* Report the specific styling or animated state observed.

**2. Form Submission Validation**
*Flow:* Wait for form -> Fill fields -> Click submit -> Observe loading state -> Wait for success/error network response or UI indication.
*Return:* Submit result status (success/error message or redirect URL).

**3. Test Case execution (Fallback for `/test-e2e`)**
When instructed to run manual tests from `e2e/{category}/{case}/test.md`, parse the `Steps` and `Expected Results` directly into your browser tool task:
*Steps 1..N*: Inject steps from the file.
*Final Step*: Take a screenshot.
*Return*: Pass/fail verification mapping directly to the "Expected Results".

### Interactive Rules & Anti-Patterns

| Category | ❌ Don't | ✅ Do |
|----------|----------|--------|
| **Setup** | Hardcode port `3000` | Read port from `XNAPIFY_PORT` or user context |
| **Auth** | Ignore auth redirects | Identify login walls and authenticate first |
| **Pacing** | Run multiple test flows at once | Test exactly ONE cohesive user flow per call |
| **Timing** | Skip waiting for page loads | Step 1 is ALWAYS waiting for exact load state |
| **Selectors** | Use vague generic descriptions | Use exact labels, text, or accessibility roles |

---

## Related Skills & Workflows

| Need | Skill / Workflow |
|------|-----------------|
| E2E CLI test runner framework | `/test-e2e` workflow |
| Backend/Unit integration testing | `test-driven-development` skill |
| Adding test templates to modules | `/add-test` workflow |
| Debugging runtime or build issues | `/debug` workflow |
| Testing WebSockets interfaces | `websocket-development` skill |
