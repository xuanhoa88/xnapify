/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * E2E Test Runner — LLM Step Interpreter
 *
 * Uses an LLM service to interpret natural language test steps
 * into structured browser actions. No hardcoded regex needed.
 *
 * Supported providers:
 *   E2E_LLM_PROVIDER=auto       → Auto-detect from IDE/CLI env keys (default)
 *   E2E_LLM_PROVIDER=stdin      → Agent callback via stdin/stdout protocol
 *   E2E_LLM_PROVIDER=openai     → OpenAI API (GPT-4o-mini default)
 *   E2E_LLM_PROVIDER=anthropic  → Anthropic API (Claude)
 *   E2E_LLM_PROVIDER=google     → Google Gemini API
 *   E2E_LLM_PROVIDER=ollama     → Local Ollama (free, private)
 *   E2E_LLM_PROVIDER=azure      → Microsoft Azure OpenAI Service
 *   E2E_LLM_PROVIDER=custom     → OpenRouter (default) or custom OpenAI-compatible endpoint
 *
 * The "auto" provider scans these env vars in order:
 *   E2E_GEMINI_API_KEY                  → google
 *   E2E_OPENAI_API_KEY                  → openai
 *   E2E_ANTHROPIC_API_KEY               → anthropic
 *   E2E_AZURE_API_KEY                   → azure
 *   E2E_OPENROUTER_API_KEY              → custom (OpenRouter)
 *   (fallback)                          → ollama
 *
 * The "stdin" provider enables AI IDE agents (Gemini, Claude, Copilot)
 * to be the LLM. The runner writes a JSON request to stdout and reads
 * the JSON action from stdin. No API key needed.
 *
 * Optional env:
 *   E2E_LLM_API_KEY  → API key (override auto-detected key)
 *   E2E_LLM_MODEL    → Model name (optional, has defaults)
 *   E2E_LLM_BASE_URL → Base URL (for custom LLM provider)
 */

const http = require('http');
const https = require('https');
const readline = require('readline');

// Module-level state
let cachedProvider = null;
let stdinRl = null;
let stdinFirstCall = true;

// ── LLM Provider Config ──────────────────────────────────────────

const LLM_PROVIDERS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    endpoint: '/chat/completions',
    authHeader: key => `Bearer ${key}`,
    jsonMode: true,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-5-haiku-latest',
    endpoint: '/messages',
    authHeader: key => key,
    authHeaderName: 'x-api-key',
    extraHeaders: { 'anthropic-version': '2023-06-01' },
  },
  google: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-3-flash-preview',
    endpoint: '/models/{model}:generateContent',
    authParam: 'key',
  },
  ollama: {
    get baseUrl() {
      return `http://${process.env.E2E_OLLAMA_HOST || process.env.XNAPIFY_HOST || '127.0.0.1'}:${process.env.E2E_OLLAMA_PORT || 11434}/v1`;
    },
    get model() {
      return process.env.E2E_OLLAMA_MODEL || 'llama3.2';
    },
    endpoint: '/chat/completions',
    authHeader: () => '',
    jsonMode: false,
    timeout: 300000,
  },
  azure: {
    get baseUrl() {
      return process.env.E2E_LLM_BASE_URL || '';
    },
    get model() {
      return process.env.E2E_LLM_MODEL || '';
    },
    get endpoint() {
      const deployment = process.env.E2E_LLM_MODEL || '';
      const apiVersion = process.env.E2E_AZURE_API_VERSION || '2024-02-01';
      return `/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
    },
    authHeader: key => key,
    authHeaderName: 'api-key',
    jsonMode: true,
  },
  custom: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemini-2.5-flash-preview',
    endpoint: '/chat/completions',
    authHeader: key => `Bearer ${key}`,
    jsonMode: true,
  },
};

// ── System Prompt ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a test automation interpreter for E2E testing.

Given a test step written in natural English and the current page/API context, return a JSON action that the test runner can execute.

The test type will be provided in context:
- "ui" → use browser actions only
- "api" → use HTTP actions only
- "system" → use both browser and HTTP actions as needed

If a step cannot be mapped to any known action, return:
{ "action": "unknown", "description": "Brief reason why the step could not be mapped" }

All browser actions map directly to Puppeteer APIs (v24+). Use page.locator() strategies wherever possible as they automatically wait for elements to be present and in the correct state.

---

## Browser Actions (for ui and system tests)

{ "action": "navigate", "url": "/admin/extensions" }
// → page.goto(url)

{ "action": "login", "description": "Log in using {{email}} and {{password}} from prerequisites" }

{
  "action": "login",
  "url": "/login",
  "email": "{{email}}",
  "password": "{{password}}",
  "description": "Log in with specific credentials from prerequisites"
}

Use the first login form when no URL override is needed. Use the second when a non-default login URL is specified in prerequisites. Always use {{email}} and {{password}} interpolation — never hardcode credential values.

{
  "action": "click",
  "selector": "button",
  "text": "Upload Extension",
  "description": "Click button with text 'Upload Extension'"
}
// → page.locator('::-p-text(Upload Extension)').click()

{
  "action": "click_within",
  "container": { "selector": "[class*='root']", "hasText": "sample-extension" },
  "target": { "selector": "input[type='checkbox']" },
  "description": "Click toggle switch within the sample-extension card"
}
// → page.locator("[class*='root']").filter({ hasText: 'sample-extension' }).locator("input[type='checkbox']").click()

{
  "action": "hover",
  "selector": "nav a",
  "text": "Products",
  "description": "Hover over the Products nav link to reveal a dropdown"
}
// → page.locator('::-p-text(Products)').hover()

{
  "action": "focus",
  "selector": "input[name='search']",
  "description": "Focus the search input"
}
// → page.locator("input[name='search']").focus()

{
  "action": "type",
  "selector": "input[type='email']",
  "value": "{{email}}",
  "description": "Type email into login field (simulates keystrokes one character at a time)"
}
// → page.locator("input[type='email']").type(value)

{
  "action": "fill",
  "selector": "input[name='username']",
  "value": "{{email}}",
  "description": "Fill username field (clears existing value then sets it atomically)"
}
// → page.locator("input[name='username']").fill(value)

{
  "action": "clear",
  "selector": "input[name='search']",
  "description": "Clear the search input field"
}
// → page.locator("input[name='search']").fill('')

{
  "action": "press_key",
  "key": "Enter",
  "description": "Press the Enter key globally"
}
// → page.keyboard.press('Enter')
// Common values: 'Enter', 'Tab', 'Escape', 'ArrowDown', 'ArrowUp', 'Backspace', 'Space'

{
  "action": "press_key",
  "selector": "input[name='search']",
  "key": "Enter",
  "description": "Press Enter while focused on the search input"
}
// → page.locator("input[name='search']").press('Enter')

{
  "action": "upload_file",
  "selector": "input[type='file']",
  "description": "Upload a file to the file input"
}
// → page.locator("input[type='file']").setInputFiles(filePath)

{
  "action": "select",
  "selector": "select[name='role']",
  "value": "admin",
  "description": "Select 'admin' from the role dropdown"
}
// → page.locator("select[name='role']").select('admin')

{
  "action": "scroll_to",
  "selector": "footer",
  "description": "Scroll the footer element into view"
}
// → page.locator('footer').scrollIntoView()

{
  "action": "scroll_page",
  "x": 0,
  "y": 500,
  "description": "Scroll the page down by 500px"
}
// → page.evaluate(() => window.scrollBy(0, 500))

{
  "action": "drag_and_drop",
  "source": "li[data-id='item-1']",
  "target": "ul[data-zone='done']",
  "description": "Drag item-1 into the done column"
}
// → page.locator(source).dragTo(page.locator(target))

{
  "action": "set_viewport",
  "width": 375,
  "height": 812,
  "description": "Set viewport to mobile dimensions (e.g. iPhone 12)"
}
// → page.setViewport({ width, height })

{
  "action": "wait_for_text",
  "text": "Extension activated successfully",
  "description": "Wait for success toast. 'timeout' is optional (milliseconds); omit to use the runner default."
}
// → page.locator('::-p-text(Extension activated successfully)').waitHandle()

{
  "action": "wait_for_selector",
  "selector": ".modal",
  "visible": true,
  "description": "Wait for the modal to appear and be visible. Set visible: false to wait until it is hidden."
}
// → page.waitForSelector('.modal', { visible: true })

{
  "action": "wait_for_navigation",
  "description": "Wait for a full page navigation to complete"
}
// → page.waitForNavigation()

{
  "action": "wait",
  "duration": 2000,
  "description": "Wait 2 seconds unconditionally"
}
// → new Promise(resolve => setTimeout(resolve, 2000))

{
  "action": "assert_url",
  "url": "/dashboard",
  "description": "Verify the current browser URL contains the given path"
}
// → expect(page.url()).toContain(url)

{
  "action": "assert_title",
  "equals": "Dashboard | MyApp",
  "description": "Verify the page title matches exactly"
}
// → expect(await page.title()).toBe('Dashboard | MyApp')

{
  "action": "reload",
  "description": "Refresh the current page"
}
// → page.reload()

{
  "action": "go_back",
  "description": "Navigate to the previous page in browser history"
}
// → page.goBack()

{
  "action": "assert_visible",
  "text": "sample-extension",
  "description": "Verify text/element is visible (selector is optional if just checking page text)"
}
// → page.locator('::-p-text(sample-extension)').waitHandle()

{
  "action": "assert_not_visible",
  "text": "sample-extension",
  "description": "Verify text is NOT present or visible on the page"
}
// → expect(await page.$('::-p-text(sample-extension)')).toBeNull()

{
  "action": "assert_checked",
  "container": { "selector": "[class*='root']", "hasText": "sample-extension" },
  "selector": "input[type='checkbox']",
  "checked": true,
  "description": "Verify toggle is checked. Set checked: false to assert unchecked."
}
// → expect(await page.locator(...).evaluate(el => el.checked)).toBe(true)

{
  "action": "assert_enabled",
  "selector": "button[type='submit']",
  "enabled": true,
  "description": "Verify an element is enabled. Set enabled: false to assert it is disabled."
}
// → expect(await page.locator("button[type='submit']").evaluate(el => !el.disabled)).toBe(true)

{
  "action": "assert_attribute",
  "selector": "img.logo",
  "attribute": "alt",
  "equals": "Company Logo",
  "description": "Verify an element's attribute value matches"
}
// → expect(await page.locator('img.logo').evaluate((el, attr) => el.getAttribute(attr), 'alt')).toBe('Company Logo')

{
  "action": "assert_count",
  "selector": "ul.results li",
  "count": 5,
  "description": "Verify exactly N matching elements are rendered"
}
// → expect((await page.$$(selector)).length).toBe(count)

{
  "action": "evaluate",
  "script": "document.title",
  "as": "pageTitle",
  "description": "Execute JavaScript in page context and optionally store the result via 'as'"
}
// → const result = await page.evaluate(() => document.title)

{
  "action": "confirm_modal",
  "description": "Click the confirm/primary button in the visible modal dialog"
}

{
  "action": "screenshot",
  "description": "Take a screenshot of the current page state"
}
// → page.screenshot()

---

## API Actions (for api and system tests)

All path values are relative to the response body (e.g., "user.email", not "response.user.email").
For arrays, use bracket notation: "items[0].id".

{
  "action": "api_request",
  "method": "POST",
  "url": "/api/auth/login",
  "body": { "email": "{{email}}", "password": "{{password}}" },
  "description": "Login with credentials from prerequisites"
}

{
  "action": "api_request",
  "method": "GET",
  "url": "/api/users/{{userId}}",
  "headers": { "Authorization": "Bearer {{authToken}}" },
  "description": "Fetch a user by ID with auth header"
}

{ "action": "assert_status", "expected": 200, "description": "Verify response status is 200" }

{ "action": "assert_body", "path": "accessToken", "exists": true, "description": "Verify token field exists in response body" }

{ "action": "assert_body", "path": "user.email", "equals": "{{email}}", "description": "Verify user email in response body" }

{ "action": "assert_body", "path": "user.email", "not_equals": "other@example.com", "description": "Verify user email does not match a value" }

{ "action": "assert_body", "path": "message", "contains": "success", "description": "Verify message field contains the word 'success'" }

{ "action": "assert_body", "path": "items", "length": 3, "description": "Verify items array has exactly 3 elements" }

{ "action": "assert_body", "path": "items[0].id", "exists": true, "description": "Verify first item has an id field" }

{ "action": "assert_header", "name": "Content-Type", "contains": "application/json", "description": "Verify JSON content type header" }

{
  "action": "store_value",
  "from": "accessToken",
  "as": "authToken",
  "description": "Store the JWT token for later use. 'from' is a body path using the same dot/bracket notation as assert_body."
}

{
  "action": "set_header",
  "name": "Authorization",
  "value": "Bearer {{authToken}}",
  "description": "Set a persistent request header using a stored value"
}

---

## Rules

- Return ONLY valid JSON. No markdown, no explanation, no wrapping text.
- The "description" field is required on every action. It should be a concise plain-English summary of what the action does.
- Use the most specific action type available for the given test type.
- For "api" tests: ONLY use api_request, assert_status, assert_body, assert_header, store_value, set_header.
- For "ui" tests: ONLY use browser actions (navigate, login, click, hover, fill, type, press_key, scroll_to, scroll_page, drag_and_drop, assert_visible, etc.).
- For "system" tests: use whichever action type best fits the step.
- For elements inside cards or containers, use "click_within" with container context.
- Prefer Puppeteer pseudo-element selectors (::-p-text, ::-p-aria) and semantic selectors over CSS class selectors when possible.
- Use "fill" when the step implies setting a field value (e.g., "enter", "set", "put"). Use "type" only when simulating keystroke-by-keystroke input is explicitly required.
- Use "scroll_to" when a specific element should come into view. Use "scroll_page" when the step implies scrolling by a pixel offset.
- Use "wait_for_selector" when waiting for a specific element state. Use "wait_for_navigation" when a full page load is expected. Reserve "wait" for unconditional delays only.
- For interpolation: ALWAYS use {{variableName}} syntax for values sourced from prerequisites or stored values. Never hardcode emails, passwords, tokens, IDs, or other runtime values.
- For login steps: use the "login" action. Use the single-field form unless the step specifies a non-default login URL.
- For purely observational steps describing visible behavior (e.g., "Observe the shimmer animation", "Watch the spinner"), return a "screenshot" action, not a "wait".
- If a step is ambiguous or cannot be mapped to a known action, return: { "action": "unknown", "description": "..." }
`;

// ── Note: Caching is handled by compiler.js (per-test script.json) ──
// interpretStep is now a pure LLM call used at compile time.

// ── HTTP Request Helper ───────────────────────────────────────────

function httpRequest(url, options, body, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const req = lib.request(parsedUrl, options, res => {
      let data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`LLM returned non-JSON: ${data.slice(0, 200)}`));
          }
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`LLM request timeout (${timeoutMs / 1000}s)`));
    });
    if (body) req.write(body);
    req.end();
  });
}

// ── JSON Extraction Helper ────────────────────────────────────────

/**
 * Extract JSON from LLM response, stripping markdown fences if present.
 * Models (especially Ollama) sometimes wrap JSON in ```json ... ``` blocks.
 */
function extractJSON(raw, providerName) {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error(
      `LLM returned invalid JSON (${providerName}): ${cleaned.slice(0, 300)}`,
    );
  }
}

// ── LLM API Calls ─────────────────────────────────────────────────

async function callOpenAI(config, prompt) {
  const url = `${config.baseUrl}${config.endpoint}`;
  const name = config.providerName || 'openai';
  const payload = {
    model: config.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
  };

  // Enable strict JSON mode only for providers that support it
  if (config.jsonMode) {
    payload.response_format = { type: 'json_object' };
  }

  const body = JSON.stringify(payload);

  const headers = { 'Content-Type': 'application/json' };
  if (typeof config.authHeader === 'function') {
    const authValue = config.authHeader(config.apiKey);
    const headerName = config.authHeaderName || 'Authorization';
    if (authValue) headers[headerName] = authValue;
  }

  const result = await httpRequest(url, { method: 'POST', headers }, body, config.timeout);
  const raw = result.choices[0].message.content;
  return extractJSON(raw, name);
}

async function callAnthropic(config, prompt) {
  const url = `${config.baseUrl}${config.endpoint}`;
  const name = config.providerName || 'anthropic';
  const body = JSON.stringify({
    model: config.model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const headers = {
    'Content-Type': 'application/json',
    [config.authHeaderName]: config.authHeader(config.apiKey),
    ...config.extraHeaders,
  };

  const result = await httpRequest(url, { method: 'POST', headers }, body, config.timeout);
  const raw = result.content[0].text;
  return extractJSON(raw, name);
}

async function callGoogle(config, prompt) {
  const endpoint = config.endpoint.replace('{model}', config.model);
  const url = `${config.baseUrl}${endpoint}?${config.authParam}=${config.apiKey}`;
  const name = config.providerName || 'google';
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });

  const headers = { 'Content-Type': 'application/json' };
  const result = await httpRequest(url, { method: 'POST', headers }, body, config.timeout);
  const raw = result.candidates[0].content.parts[0].text;
  return extractJSON(raw, name);
}

// ── Auto-Detect Provider ──────────────────────────────────────────

const PROVIDER_ENV_KEYS = {
  google: 'E2E_GEMINI_API_KEY',
  openai: 'E2E_OPENAI_API_KEY',
  anthropic: 'E2E_ANTHROPIC_API_KEY',
  azure: 'E2E_AZURE_API_KEY',
  custom: 'E2E_OPENROUTER_API_KEY',
};

/**
 * Scan env vars for LLM provider and API keys.
 * Returns { provider, apiKey } and caches the result.
 */
function getProviderCredentials() {
  if (cachedProvider) return cachedProvider;

  let provider = process.env.E2E_LLM_PROVIDER || 'auto';
  let apiKey = process.env.E2E_LLM_API_KEY || '';

  if (provider === 'auto') {
    for (const [p, k] of Object.entries(PROVIDER_ENV_KEYS)) {
      if (process.env[k]) {
        provider = p;
        apiKey = apiKey || process.env[k];
        break;
      }
    }
    if (provider === 'auto') provider = 'ollama';
  } else if (!apiKey) {
    const envKey = PROVIDER_ENV_KEYS[provider];
    if (envKey) apiKey = process.env[envKey] || '';
  }

  cachedProvider = { provider, apiKey };
  return cachedProvider;
}

// ── Stdin Provider (Agent Callback) ───────────────────────────────

/**
 * Send step to stdout with a protocol marker, read action from stdin.
 * This allows an AI IDE agent to be the interpreter.
 *
 * Protocol:
 *   Runner writes: {"e2e_request": "interpret", "step": "...", "context": {...}}
 *   Agent writes:  {"action": "click", "text": "Upload Extension"}
 */
async function callStdin(prompt, step, context, lastAttemptError) {
  const stdinTimeout = parseInt(
    process.env.E2E_LLM_TIMEOUT || '300000',
    10,
  );

  const request = {
    e2e_request: 'interpret',
    step,
    prompt,
    context: {
      phase: context.phase,
      testName: context.testName,
      currentUrl: context.currentUrl,
      prerequisites: context.prerequisites || {},
    },
  };

  // Send system_prompt only on first call to avoid redundant 2.8KB per step
  if (stdinFirstCall) {
    request.system_prompt = SYSTEM_PROMPT;
    stdinFirstCall = false;
  }

  // Forward the last attempt's error so the agent can self-correct
  if (lastAttemptError) {
    request.last_error = lastAttemptError;
  }

  // Write request using a protocol marker for easy parsing
  process.stdout.write(`\n[E2E:INTERPRET] ${JSON.stringify(request)}\n`);

  // Use singleton readline interface to avoid stdin exhaustion
  if (!stdinRl) {
    stdinRl = readline.createInterface({ input: process.stdin });
    stdinRl.on('close', () => {
      stdinRl = null;
    });
  }

  // Read response from stdin
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `stdin timeout: no response from agent after ${stdinTimeout / 1000}s`,
        ),
      );
    }, stdinTimeout);

    const onLine = line => {
      const trimmed = line.trim();

      // Look for our protocol marker
      if (trimmed.startsWith('[E2E:ACTION]')) {
        clearTimeout(timeout);
        stdinRl.removeListener('line', onLine);
        const json = trimmed.slice('[E2E:ACTION]'.length).trim();
        try {
          resolve(extractJSON(json, 'stdin'));
        } catch (err) {
          reject(err);
        }
        return;
      }

      // Also accept raw JSON (for simpler integrations)
      if (trimmed.startsWith('{') || trimmed.startsWith('```')) {
        try {
          const parsed = extractJSON(trimmed, 'stdin');
          if (parsed.action) {
            clearTimeout(timeout);
            stdinRl.removeListener('line', onLine);
            resolve(parsed);
          }
        } catch {
          // Malformed input — log hint and keep waiting
          console.log(
            `    ⚠ stdin: ignoring malformed input (${trimmed.slice(0, 80)}...)`,
          );
        }
      }
    };

    stdinRl.on('line', onLine);
  });
}

// Provider → caller mapping
const CALLERS = {
  openai: callOpenAI,
  anthropic: callAnthropic,
  google: callGoogle,
  ollama: callOpenAI, // Ollama uses OpenAI-compatible API
  custom: callOpenAI, // Custom also uses OpenAI-compatible API
  azure: callOpenAI, // Azure uses OpenAI-compatible API with api-key header
};

// ── Main: Interpret Step ──────────────────────────────────────────

async function interpretStep(step, context) {
  const { provider, apiKey } = getProviderCredentials();

  // Build prompt with page context + prerequisites
  const prereqs = context.prerequisites || {};
  let prereqText = '';
  if (Object.keys(prereqs).length > 0) {
    prereqText = '\nPrerequisites:\n';
    for (const [k, v] of Object.entries(prereqs)) {
      prereqText += `  ${k}: ${v}\n`;
    }
  }

  const errorFeedback = context.lastError
    ? `\n⚠️ PREVIOUS EXECUTION FAILED WITH ERROR:\n${context.lastError}\nPlease fix your JSON action to resolve this error!\n`
    : '';

  const prompt = `Current page: ${context.currentUrl || 'unknown'}
Test case: ${context.testName || 'unknown'}
${prereqText}${context.expectedResults && context.expectedResults.length > 0 ? `\nExpected Results:\n${context.expectedResults.map(e => `  - ${e}`).join('\n')}\n` : ''}${errorFeedback}
Step to interpret:
"${step}"

Return the JSON action to perform this step.`;

  // Call LLM with retry
  let action;
  const maxRetries = 2;
  let lastAttemptError = null;

  let providerConfig, caller;
  if (provider !== 'stdin') {
    providerConfig = { ...LLM_PROVIDERS[provider] };
    if (!providerConfig) {
      throw new Error(
        `Unknown LLM provider: ${provider}. Use: auto, stdin, openai, anthropic, google, ollama, azure, custom`,
      );
    }

    providerConfig.apiKey = apiKey;
    providerConfig.providerName = provider;
    if (process.env.E2E_LLM_MODEL)
      providerConfig.model = process.env.E2E_LLM_MODEL;
    if (process.env.E2E_LLM_BASE_URL)
      providerConfig.baseUrl = process.env.E2E_LLM_BASE_URL;
    if (process.env.E2E_LLM_TIMEOUT)
      providerConfig.timeout = parseInt(process.env.E2E_LLM_TIMEOUT, 10);

    // If authHeader('') produces output, the provider requires a real key
    if (providerConfig.authHeader('') && !providerConfig.apiKey) {
      throw new Error(
        `API key required for ${provider}. Set E2E_LLM_API_KEY or provider env var (e.g., E2E_AZURE_API_KEY).`,
      );
    }

    caller = CALLERS[provider];
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (provider === 'stdin') {
        action = await callStdin(prompt, step, context, lastAttemptError);
      } else {
        action = await caller(providerConfig, prompt);
      }

      // Validate that LLM respected the action schema
      const actionList = Array.isArray(action) ? action : [action];
      for (const act of actionList) {
        if (
          !act ||
          typeof act !== 'object' ||
          Array.isArray(act) ||
          !act.action
        ) {
          throw new Error(
            `LLM returned invalid schema: expected action object with 'action' property, got ${JSON.stringify(act)} `,
          );
        }
      }

      break;
    } catch (err) {
      lastAttemptError = err.message;
      if (attempt === maxRetries) throw err;
      const delay = 1000 * (attempt + 1);
      console.log(
        `    ⏳ ${provider === 'stdin' ? 'stdin agent' : 'LLM'} retry in ${delay}ms... (${err.message})`,
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }

  return action;
}

module.exports = {
  interpretStep,
  SYSTEM_PROMPT,
  LLM_PROVIDERS,
  PROVIDER_ENV_KEYS,
};
