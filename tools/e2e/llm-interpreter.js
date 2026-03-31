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
 *   E2E_LLM_PROVIDER=custom     → Custom endpoint
 *
 * The "auto" provider scans these env vars in order:
 *   GEMINI_API_KEY | GOOGLE_API_KEY → google
 *   OPENAI_API_KEY                  → openai
 *   ANTHROPIC_API_KEY               → anthropic
 *   (fallback)                      → ollama
 *
 * The "stdin" provider enables AI IDE agents (Gemini, Claude, Copilot)
 * to be the LLM. The runner writes a JSON request to stdout and reads
 * the JSON action from stdin. No API key needed.
 *
 * Optional env:
 *   E2E_LLM_API_KEY  → API key (override auto-detected key)
 *   E2E_LLM_MODEL    → Model name (optional, has defaults)
 *   E2E_LLM_BASE_URL → Base URL (for custom/ollama)
 */

/* eslint-disable no-console */

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const readline = require('readline');

const config = require('../config');

// Module-level state
let cachedProvider = null;
let stdinRl = null;
let stdinFirstCall = true;

// ── LLM Provider Config ──────────────────────────────────────────

const PROVIDERS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    endpoint: '/chat/completions',
    authHeader: key => `Bearer ${key}`,
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
    model: 'gemini-2.0-flash',
    endpoint: '/models/{model}:generateContent',
    authParam: 'key',
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    endpoint: '/chat/completions',
    authHeader: () => '',
  },
  custom: {
    baseUrl: '',
    model: '',
    endpoint: '/chat/completions',
    authHeader: key => `Bearer ${key}`,
  },
};

// ── System Prompt ─────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a browser automation interpreter for E2E testing.

Given a test step written in natural English and the current page context,
return a JSON action that the test runner can execute via Puppeteer.

## Available Actions

{
  "action": "navigate",
  "url": "/admin/extensions"
}

{
  "action": "login",
  "description": "Log in with admin credentials"
}

{
  "action": "login",
  "url": "/login",
  "email": "user@example.com",
  "password": "secret",
  "description": "Log in with specific credentials"
}

{
  "action": "click",
  "selector": "button",
  "text": "Upload Extension",
  "description": "Click button with text 'Upload Extension'"
}

{
  "action": "click_within",
  "container": { "selector": "[class*='root']", "hasText": "sample-extension" },
  "target": { "selector": "input[type='checkbox']" },
  "description": "Click toggle switch within the sample-extension card"
}

{
  "action": "type",
  "selector": "input[type='email']",
  "value": "admin@example.com",
  "description": "Type email into login field"
}

{
  "action": "upload_file",
  "selector": "input[type='file']",
  "description": "Upload a file to the file input"
}

{
  "action": "wait_for_text",
  "text": "Extension activated successfully",
  "timeout": 60000,
  "description": "Wait for success toast"
}

{
  "action": "wait",
  "duration": 2000,
  "description": "Wait 2 seconds"
}

{
  "action": "reload",
  "description": "Refresh the page"
}

{
  "action": "assert_visible",
  "selector": "h3",
  "text": "sample-extension",
  "description": "Verify extension card is visible"
}

{
  "action": "assert_not_visible",
  "text": "sample-extension",
  "description": "Verify extension card is NOT visible"
}

{
  "action": "assert_checked",
  "container": { "selector": "[class*='root']", "hasText": "sample-extension" },
  "selector": "input[type='checkbox']",
  "checked": true,
  "description": "Verify toggle is checked"
}

{
  "action": "confirm_modal",
  "description": "Click the confirm/primary button in the visible modal dialog"
}

{
  "action": "screenshot",
  "description": "Take a screenshot"
}

## Rules
- Return ONLY valid JSON, no markdown, no explanation
- Use the most specific action type available
- For elements inside cards/containers, use "click_within" with container context
- For assertions, use "assert_visible", "assert_not_visible", "assert_checked"
- "text" fields should match visible text content on the page
- Prefer text-based selectors over CSS class selectors when possible
- If the step is observational (e.g., "Observe the shimmer animation"), return a "wait" action with 1000ms
- For login steps, use the "login" action with credentials from the test prerequisites
- Prerequisites provide context like email, password, role, url — use them in your actions`;

// ── Cache ─────────────────────────────────────────────────────────

const CACHE_FILE = path.join(__dirname, '.step-cache.json');

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
    }
  } catch {
    // Corrupted cache — ignore
  }
  return {};
}

function saveCache(cache) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function getCacheKey(step, contextHint, urlHint) {
  return `${contextHint || ''}::${urlHint || ''}::${step}`.toLowerCase().trim();
}

// ── HTTP Request Helper ───────────────────────────────────────────

function httpRequest(url, options, body) {
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
          resolve(JSON.parse(data));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('LLM request timeout (30s)'));
    });
    if (body) req.write(body);
    req.end();
  });
}

// ── LLM API Calls ─────────────────────────────────────────────────

async function callOpenAI(config, prompt) {
  const url = `${config.baseUrl}${config.endpoint}`;
  const body = JSON.stringify({
    model: config.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const headers = { 'Content-Type': 'application/json' };
  if (typeof config.authHeader === 'function') {
    const authValue = config.authHeader(config.apiKey);
    if (authValue) headers.Authorization = authValue;
  }

  const result = await httpRequest(url, { method: 'POST', headers }, body);
  return JSON.parse(result.choices[0].message.content);
}

async function callAnthropic(config, prompt) {
  const url = `${config.baseUrl}${config.endpoint}`;
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

  const result = await httpRequest(url, { method: 'POST', headers }, body);
  const { text } = result.content[0];
  return JSON.parse(text);
}

async function callGoogle(config, prompt) {
  const endpoint = config.endpoint.replace('{model}', config.model);
  const url = `${config.baseUrl}${endpoint}?${config.authParam}=${config.apiKey}`;
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json' },
  });

  const headers = { 'Content-Type': 'application/json' };
  const result = await httpRequest(url, { method: 'POST', headers }, body);
  const { text } = result.candidates[0].content.parts[0];
  return JSON.parse(text);
}

// ── Auto-Detect Provider ──────────────────────────────────────────

/**
 * Scan env vars for existing API keys from IDE/CLI tools.
 * Returns { provider, apiKey } or falls back to ollama.
 */
function autoDetectProvider() {
  // Return cached result if already detected
  if (cachedProvider) return cachedProvider;

  // Gemini / Google
  const geminiKey =
    config.env('GEMINI_API_KEY') || config.env('GOOGLE_API_KEY') || '';
  if (geminiKey) {
    cachedProvider = { provider: 'google', apiKey: geminiKey };
    return cachedProvider;
  }

  // OpenAI / Copilot
  const openaiKey = config.env('OPENAI_API_KEY') || '';
  if (openaiKey) {
    cachedProvider = { provider: 'openai', apiKey: openaiKey };
    return cachedProvider;
  }

  // Anthropic / Claude
  const anthropicKey = config.env('ANTHROPIC_API_KEY') || '';
  if (anthropicKey) {
    cachedProvider = { provider: 'anthropic', apiKey: anthropicKey };
    return cachedProvider;
  }

  // Fallback to Ollama (local, free)
  cachedProvider = { provider: 'ollama', apiKey: '' };
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
async function callStdin(prompt, step, context) {
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
      reject(new Error('stdin timeout: no response from agent after 60s'));
    }, 60000);

    const onLine = line => {
      const trimmed = line.trim();

      // Look for our protocol marker
      if (trimmed.startsWith('[E2E:ACTION]')) {
        clearTimeout(timeout);
        stdinRl.removeListener('line', onLine);
        const json = trimmed.slice('[E2E:ACTION]'.length).trim();
        try {
          resolve(JSON.parse(json));
        } catch {
          reject(new Error(`Invalid JSON from agent: ${json.slice(0, 200)}`));
        }
        return;
      }

      // Also accept raw JSON (for simpler integrations)
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.action) {
            clearTimeout(timeout);
            stdinRl.removeListener('line', onLine);
            resolve(parsed);
          }
        } catch {
          // Not valid JSON, keep waiting
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
};

// ── Main: Interpret Step ──────────────────────────────────────────

async function interpretStep(step, context) {
  let provider = config.env('E2E_LLM_PROVIDER') || 'auto';
  let apiKey = config.env('E2E_LLM_API_KEY') || '';

  // Auto-detect provider from IDE/CLI env keys
  if (provider === 'auto') {
    const detected = autoDetectProvider();
    provider = detected.provider;
    apiKey = apiKey || detected.apiKey;
  }

  // Check cache first
  const cache = loadCache();
  const cacheKey = getCacheKey(step, context.phase, context.currentUrl);
  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  // Build prompt with page context + prerequisites
  const prereqs = context.prerequisites || {};
  let prereqText = '';
  if (Object.keys(prereqs).length > 0) {
    prereqText = '\nPrerequisites:\n';
    for (const [k, v] of Object.entries(prereqs)) {
      prereqText += `  ${k}: ${v}\n`;
    }
  }

  const prompt = `Current page: ${context.currentUrl || 'unknown'}
Phase: ${context.phase || 'unknown'}
Test case: ${context.testName || 'unknown'}
${prereqText}
Step to interpret:
"${step}"

Return the JSON action to perform this step.`;

  // Call LLM with retry
  let action;
  const maxRetries = 2;

  if (provider === 'stdin') {
    // Stdin mode — delegate to IDE agent, no retry
    action = await callStdin(prompt, step, context);
  } else {
    const providerConfig = { ...PROVIDERS[provider] };
    if (!providerConfig) {
      throw new Error(
        `Unknown LLM provider: ${provider}. Use: auto, stdin, openai, anthropic, google, ollama, custom`,
      );
    }

    providerConfig.apiKey = apiKey;
    if (config.env('E2E_LLM_MODEL'))
      providerConfig.model = config.env('E2E_LLM_MODEL');
    if (config.env('E2E_LLM_BASE_URL'))
      providerConfig.baseUrl = config.env('E2E_LLM_BASE_URL');

    if (provider !== 'ollama' && !providerConfig.apiKey) {
      throw new Error(
        `API key required for ${provider}. Set E2E_LLM_API_KEY or provider env var (e.g., GOOGLE_API_KEY).`,
      );
    }

    const caller = CALLERS[provider];
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        action = await caller(providerConfig, prompt);
        break;
      } catch (err) {
        if (attempt === maxRetries) throw err;
        const delay = 1000 * (attempt + 1);
        console.log(`    ⏳ LLM retry in ${delay}ms... (${err.message})`);
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  // Cache the result
  cache[cacheKey] = action;
  saveCache(cache);

  return action;
}

module.exports = { interpretStep, SYSTEM_PROMPT };
