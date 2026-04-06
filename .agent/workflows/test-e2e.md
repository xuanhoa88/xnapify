---
description: Run E2E test cases from a module's e2e/ folder using AI agent browser automation
---

Run E2E tests by reading natural language test cases from `test.md` files colocated inside each module's `e2e/` directory. Supports **3 test types**: browser UI tests, HTTP API integration tests, and mixed system tests.

## Quick Start (CLI)

The primary way to run E2E tests is via the **Chromium CLI tool**:

```bash
# Auto mode (default): compile if needed, then run
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Compile all test cases (generates script.json via LLM, no browser)
node tools/e2e/runner.js --mode=compile

# Run using compiled scripts only (no LLM calls, fast)
node tools/e2e/runner.js --mode=run

# Force recompile even if test.md hasn't changed
node tools/e2e/runner.js --mode=compile --force

# Run a specific module (all test types)
node tools/e2e/runner.js extensions

# Run a specific extension (all test types)
node tools/e2e/runner.js posts-module

# Run a specific category within a module
node tools/e2e/runner.js extensions/install

# Run a single test case (UI)
node tools/e2e/runner.js quick-access-plugin/login/01-buttons-visible

# Run all API tests for a module
node tools/e2e/runner.js quick-access-plugin/api

# Run a specific API test category
node tools/e2e/runner.js quick-access-plugin/api/auth

# Run a single API test case
node tools/e2e/runner.js quick-access-plugin/api/auth/01-login-jwt
```

> [!TIP]
> Credentials are defined per-test in YAML front-matter. No env vars needed for auth!
> LLM auto-detects from existing IDE API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.)

**Environment variables:**

| Variable           | Required | Description                                                                    |
| ------------------ | -------- | ------------------------------------------------------------------------------ |
| `XNAPIFY_PORT`     | No       | App port (auto-detected from `.env`, default: `1337`)                          |
| `E2E_HEADLESS`     | No       | `false` to show browser (default: `true`)                                      |
| `E2E_FIXTURE_ZIP`  | No       | Path to test extension `.zip` for install tests                                |
| `E2E_EMAIL`        | No       | Login email fallback (prefer YAML front-matter in test files)                  |
| `E2E_PASSWORD`     | No       | Login password fallback (prefer YAML front-matter in test files)               |
| `E2E_LLM_PROVIDER` | No       | `auto` (default), `stdin`, `openai`, `anthropic`, `google`, `ollama`, `custom` |
| `E2E_LLM_API_KEY`  | No       | Override auto-detected API key                                                 |
| `E2E_LLM_MODEL`    | No       | Model name override (each provider has a default)                              |
| `E2E_LLM_BASE_URL` | No       | Base URL override (for custom/ollama)                                          |
| `E2E_DEBUG`        | No       | `true` to show SPA stability diagnostics                                       |

## How it works

The CLI tool (`tools/e2e/runner.js`) uses a **compile-once, run-many** architecture:

### Test Types

Test type is **auto-detected from the directory structure**:

| Directory                       | Type      | What it does                     | Browser? | Speed |
| ------------------------------- | --------- | -------------------------------- | -------- | ----- |
| `e2e/{category}/{case}/`        | 🌐 UI     | Browser automation via Puppeteer | ✅ Yes   | ~12s  |
| `e2e/ui/{category}/{case}/`     | 🌐 UI     | Explicit browser test            | ✅ Yes   | ~12s  |
| `e2e/api/{category}/{case}/`    | 🔌 API    | HTTP requests only (no browser)  | ❌ No    | ~0.5s |
| `e2e/system/{category}/{case}/` | 🔗 System | Browser + HTTP combined          | ✅ Yes   | ~12s  |

> [!TIP]
> API tests are ~25x faster than UI tests. Use them for endpoint validation, auth flows, RBAC checks.

### Compilation (LLM → script.json)

1. Discover `test.md` files in the nested `e2e/` hierarchy
2. Parse YAML front-matter (credentials) + markdown AST (test steps) via `front-matter` + `markdown-it`
3. Auto-detect an LLM provider from IDE/CLI env vars (or use `stdin` for agent callback)
4. Send each English step to the LLM for interpretation into a structured JSON action
5. The LLM receives the **test type** and generates appropriate actions (browser or API)
6. Save the compiled script as `script.json` + a `.test-hash` (SHA256 of `test.md`)

### Execution (script.json → Puppeteer / HTTP)

1. Load the pre-compiled `script.json` (no LLM needed!)
2. Detect test types and launch browser **only if UI/system tests exist**
3. For UI: execute via Puppeteer with SPA stability detection (5-signal engine)
4. For API: execute via Node.js HTTP client (zero dependencies, no browser)
5. Take per-step screenshots for UI tests (`step-01.png`, `step-02.png`, ...) and final state (`final.png`)
6. Write per-test `result.md` and module-level `_summary.md`
7. Auto-recompile any failed step via LLM and retry once (self-healing)

### When compilation happens

| Scenario                         | LLM called?                                      |
| -------------------------------- | ------------------------------------------------ |
| First run (no `script.json`)     | ✅ Yes — compiles via LLM                        |
| Subsequent runs (hash matches)   | ❌ No — uses `script.json`                       |
| `test.md` edited (hash mismatch) | ✅ Yes — archives old script, recompiles         |
| `--mode=compile --force`         | ✅ Yes — force recompile                         |
| Compiled step fails at runtime   | ✅ Yes — recompiles that step only, retries once |

## AI Agent Fallback

If the CLI tool doesn't support a specific step pattern, or for exploratory testing,
AI agents can also execute `test.md` test cases directly using their browser automation:

> [!IMPORTANT]
> Read the `browser-testing` skill (`view_file .agent/skills/browser-testing/SKILL.md`) for port discovery, task formatting, and auth handling rules.

## Test Case Format

Each module's `e2e/` directory uses a **nested structure**: one `test.md` per test case, organized by type and category.

```
e2e/
  {category}/                ← UI tests (legacy, backward compatible)
    {NN-name}/
      test.md
      script.json
  ui/                        ← Explicit UI tests
    {category}/
      {NN-name}/
        test.md
        script.json
  api/                       ← API integration tests (no browser)
    {category}/
      {NN-name}/
        test.md
        script.json
  system/                    ← Mixed browser + API tests
    {category}/
      {NN-name}/
        test.md
        script.json
```

Each test case directory contains:

- `test.md` — test case definition (tester writes this)
- `script.json` — compiled automation actions (LLM generates, committed)
- `.test-hash` — sha256 of test.md at compile time (gitignored)
- `scripts/` — archived old scripts (committed for history)
- `_reports/` — test run reports (text committed, binary gitignored)

### UI test.md format (browser tests)

```markdown
---
email: admin@example.com
password: admin123
role: admin
---

# Test Case Title

Description of what this test validates.

### Prerequisite

- fixture_zip: ./test-fixtures/sample-extension.zip

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Step instruction in natural English
4. ...

## Expected Results

- The extensions page loads with an upload button visible
- A success toast appears after installation
- The new extension card is visible in the grid
```

### API test.md format (HTTP integration tests)

```markdown
---
email: admin@example.com
password: admin123
---

# Login API Returns Valid JWT

Verify the authentication endpoint returns a valid JWT token.

## Steps

1. Send POST request to /api/auth/login with email and password from prerequisites
2. Assert response status is 200
3. Assert response body contains "accessToken" field
4. Use the token to send GET request to /api/auth/profile
5. Assert response status is 200
6. Assert response body field "user.email" equals "admin@example.com"

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
```

### Syntax Reference

- **YAML front-matter** (`---`) = Prerequisites (credentials, fixtures)
- **H1 (`#`)** = Test case title (one per file)
- **Paragraph text** = Description (not executed)
- **H3 `### Prerequisite`** = Per-test overrides (merged with front-matter)
- **`## Steps`** = Executable actions (numbered list, `1.`, `2.`, ...)
- **`## Expected Results`** = Acceptance criteria (bullet list)

### Directory Naming Convention

Test cases use optional **type**, **category**, and **NN-name** directories:

```
e2e/
  login/                          ← UI tests (legacy layout, backward compatible)
    01-buttons-visible/test.md
    02-demo-login/test.md
  api/                            ← API integration tests
    auth/
      01-login-jwt/test.md
      02-invalid-creds/test.md
    users/
      01-list-pagination/test.md
  system/                         ← Mixed tests
    user-flow/
      01-register-login-profile/test.md
```

Categories group related tests (e.g., `auth`, `login`, `install`).
Cases use `NN-name` numbering for execution order.

### 1. Ensure the app is running (MANDATORY)

The E2E suite requires a running application. If the app is not reachable at the resolved port, the runner will wait for up to 30s (configurable via `E2E_STARTUP_TIMEOUT`) before failing.

**Pre-flight check:**
- Ensure `npm run dev` is running in a separate terminal.
- Verify the app is reachable at `http://localhost:{PORT}`.

### 2. Resolve the port (MANDATORY)

Follow the `browser-testing` skill port discovery rules — same priority order:

| Priority | Source           | How                                                                  |
| -------- | ---------------- | -------------------------------------------------------------------- |
| 1        | User context     | Check running terminal outputs for `localhost:XXXX`                  |
| 2        | `.env` files     | `grep XNAPIFY_PORT .env .env.* 2>/dev/null` — use the **last** match |
| 3        | Default fallback | `1337`                                                               |

> [!CAUTION] > **NEVER** guess or assume port 3000. Always resolve from user context or `.env` files first.

// turbo

### 2. Discover test case files

Find all `test.md` files in the target module or extension's `e2e/` directory.

**For a specific module or extension:**

```bash
# Core module (e.g., extensions, users)
find src/apps/{module}/e2e -name "test.md" -type f 2>/dev/null | sort

# Installed extension (e.g., posts-module, oauth-google-plugin)
find src/extensions/{extension}/e2e -name "test.md" -type f 2>/dev/null | sort
```

**For ALL e2e tests across the project:**

```bash
find src/apps src/extensions -path "*/e2e/*/test.md" -type f 2>/dev/null | sort
```

### 3. Read and parse each test case file

Use your file reading tool to read each `test.md` file. Parse into structured data:

- **H1 line** → Test case title
- **`## Steps`** → Numbered list of actions to execute
- **`## Expected Results`** → Bullet list of acceptance criteria to verify
- **Non-heading, non-list paragraphs** → Description (skip during execution)

### 4. Handle authentication FIRST

Before executing any test case, ensure the browser is authenticated.

Follow the `browser-testing` skill auth rules:

1. Open the browser to the target admin page
2. If redirected to `/login`, fill in admin credentials and submit
3. Wait for redirect back to the authenticated page
4. Ask the user for credentials if not known — **do NOT guess passwords**
5. Keep the browser session open for subsequent tests

### 5. Execute each test case

For each test case, use your browser automation tool to execute **ONE test case at a time**.

Build the task from the parsed steps and expected results following the `browser-testing` skill template:

```
Navigate to http://localhost:{PORT}/{admin-page}.

Steps:
1. Wait for the page to fully load (look for the page header or main content).
2. {step 1 from the test.md file}
3. {step 2 from the test.md file}
...
N. Take a screenshot of the final state.

Expected Results:
- {expected result 1 from the test.md file}
- {expected result 2 from the test.md file}
...

Return: Describe what happened at each step. Did all steps succeed?
Verify each expected result was met. Report any failures or unexpected UI states.
```

### 6. Store individual test case results

Results are stored inside each test case's directory:

**Result directory:** `e2e/{category}/{NN-name}/_reports/{timestamp}/`

Contents:

- `result.md` — Structured pass/fail report
- `step-01.png`, `step-02.png`, ... — Per-step screenshots
- `final.png` — Final state screenshot
- `*.webp` — Video evidence (if captured by agent)

**Result file format:**

```markdown
# {Test Case Title}

**Source:** {path to test.md file}
**Type:** 🌐 UI | 🔌 API | 🔗 System
**Date:** {ISO timestamp}
**Result:** ✅ PASS | ❌ FAIL
**Duration:** {ms}

## Steps Executed

1. ✅ Navigate to extensions admin page — navigate: Open admin page
2. ✅ Click toggle switch — click: Toggle activation switch
3. ❌ Wait for toast — Timeout waiting for element

## Expected Results

- The extension shows as active

## Notes

{Any observations, warnings, or failure details}

## Evidence

### Screenshots

- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [final.png](./final.png)

### Videos

- [recording.webp](./recording.webp)
```

### 7. Create summary report

After ALL test cases in a module are executed, a module-level summary is created:

**Summary path:** `e2e/_reports/{timestamp}/_summary.md`

**Summary format:**

```markdown
# E2E Test Results: {module or extension name}

**Date:** {timestamp}
**Port:** {resolved port}
**Total:** {passed}/{total} passed
**Duration:** {total time}ms

## Results

| #   | Test Case          | Title                | Result  | Details                                                          |
| --- | ------------------ | -------------------- | ------- | ---------------------------------------------------------------- |
| 1   | install/01-upload  | Upload valid package | ✅ PASS | [result](../../install/01-upload/_reports/{timestamp}/result.md)  |
| 2   | activate/01-toggle | Toggle switch        | ❌ FAIL | [result](../../activate/01-toggle/_reports/{timestamp}/result.md) |

## Failed Tests

### activate/01-toggle: Toggle switch

- **Error:** Timeout waiting for element
- **Result:** [result](../../activate/01-toggle/_reports/{timestamp}/result.md)
```

## Results Directory Structure

```
src/extensions/quick-access-plugin/e2e/
├── login/                                   ← UI tests (legacy layout)
│   ├── 01-buttons-visible/                  ← Test case
│   │   ├── test.md                          ← Test definition (committed)
│   │   ├── script.json                      ← Compiled automation (committed)
│   │   ├── .test-hash                       ← Hash of test.md (gitignored)
│   │   ├── scripts/                         ← Archived old scripts (committed)
│   │   │   └── 2026-04-01_10-03.json
│   │   └── _reports/                        ← Test run reports
│   │       └── 2026-04-02_13-49/
│   │           ├── result.md                ← Text report (committed)
│   │           ├── step-01.png              ← Binary evidence (gitignored)
│   │           ├── step-02.png              ← Binary evidence (gitignored)
│   │           ├── final.png                ← Binary evidence (gitignored)
│   │           └── recording.webp           ← Binary evidence (gitignored)
│   └── 02-demo-login/
│       ├── test.md
│       └── script.json
├── api/                                     ← API integration tests
│   └── auth/
│       └── 01-login-jwt/
│           ├── test.md
│           ├── script.json
│           └── _reports/
│               └── 2026-04-02_09-06/
│                   └── result.md            ← No screenshots (API-only)
└── _reports/                                ← Module-level summaries
    └── 2026-04-02_13-49/
        └── _summary.md                      ← Text summary (committed)
```

## Compiled Scripts (script.json)

Each test case gets a `script.json` — a compiled automation script:

### UI script example

```json
{
  "version": 1,
  "compiledAt": "2026-04-02T07:00:00.000Z",
  "testHash": "a1b2c3d4e5f6...",
  "title": "Quick Access Buttons Visible on Login Page",
  "actions": [
    {
      "step": 1,
      "action": "navigate",
      "url": "/login",
      "description": "Open the login page"
    },
    {
      "step": 2,
      "action": "wait",
      "duration": 2000,
      "description": "Wait for page load"
    },
    {
      "step": 3,
      "action": "assert_visible",
      "text": "Admin User",
      "description": "Verify button"
    }
  ]
}
```

### API script example

```json
{
  "version": 1,
  "compiledAt": "2026-04-02T09:06:00.000Z",
  "testHash": "691e7a81aaf0...",
  "title": "Login API Returns Valid JWT",
  "actions": [
    {
      "step": 1,
      "action": "api_request",
      "method": "POST",
      "url": "/api/auth/login",
      "body": { "email": "admin@example.com", "password": "admin123" }
    },
    { "step": 2, "action": "assert_status", "expected": 200 },
    {
      "step": 3,
      "action": "assert_body",
      "path": "data.accessToken",
      "exists": true
    },
    {
      "step": 4,
      "action": "store_value",
      "from": "response.data.accessToken",
      "as": "authToken"
    },
    {
      "step": 5,
      "action": "set_header",
      "name": "Authorization",
      "value": "Bearer {{authToken}}"
    },
    {
      "step": 6,
      "action": "api_request",
      "method": "GET",
      "url": "/api/auth/profile"
    },
    { "step": 7, "action": "assert_status", "expected": 200 },
    {
      "step": 8,
      "action": "assert_body",
      "path": "data.user.email",
      "equals": "admin@example.com"
    }
  ]
}
```

### Available API actions

| Action          | Description           | Key Fields                                |
| --------------- | --------------------- | ----------------------------------------- |
| `api_request`   | Send HTTP request     | `method`, `url`, `body`, `headers`        |
| `assert_status` | Check status code     | `expected` (number)                       |
| `assert_body`   | Check JSON response   | `path`, `exists`/`equals`/`contains`      |
| `assert_header` | Check response header | `name`, `exists`/`contains`               |
| `store_value`   | Save value for reuse  | `from` (e.g. `response.data.token`), `as` |
| `set_header`    | Set persistent header | `name`, `value` (supports `{{var}}`)      |

- **Committed to git** — teammates run tests without needing LLM API keys
- **Auto-archived** — when `test.md` changes, old script moves to `scripts/` for history
- **Self-healing** — if a compiled action fails, runner auto-recompiles via LLM and retries

## Rules

These rules extend the `browser-testing` skill rules:

| Rule                  | Description                                                                                              |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| **Skill first**       | Read `browser-testing` skill before starting — it defines port discovery, task format, and auth handling |
| **App first**        | Verify the app is reachable at the base URL before starting any tests                    |
| **Port first**       | Resolve port using the 3-priority system before building any URL                         |
| **One flow per call** | Execute ONE test case per browser automation call                                                        |
| **Serial execution**  | Run test cases in file order (01 → 02 → 03...) since later phases depend on earlier state                |
| **Screenshot proof**  | Always request a screenshot at the end of each test case                                                 |
| **Wait for load**     | Always prepend "Wait for the page to fully load" as the first step                                       |
| **Auth first**        | Handle login before any test case                                                                        |
| **Store results**     | Write results inside each test case's `_reports/{timestamp}/` directory                                   |
| **Report clearly**    | Create `_summary.md` with ✅/❌ table after all tests complete                                           |
| **No guessing**       | Ask the user for credentials / URLs if not known — never assume                                          |
| **Compile first**     | Run `--mode=compile` before `--mode=run` if no `script.json` exists                                      |

## Anti-Patterns

| ❌ Don't                        | ✅ Do                                                              |
| ------------------------------- | ------------------------------------------------------------------ |
| Hardcode port 3000              | Resolve via `.env` or user context                                 |
| Test multiple cases in one call | One browser automation call per test case                          |
| Skip page load wait             | Always wait for specific content first                             |
| Use vague "click the button"    | Use exact text: `Click the "Upload Extension" button`              |
| Ignore auth redirects           | Handle login in a dedicated pre-test step                          |
| Run tests in random order       | Follow directory numbering order (01 → 02 → 03...)                 |
| Guess admin passwords           | Ask the user if credentials are not known                          |
| Only search `src/apps/`         | Search BOTH `src/apps/` and `src/extensions/` for `e2e/` folders   |
| Use flat `.md` files            | Use nested `e2e/{category}/{NN-name}/test.md` structure            |
| Call LLM on every run           | Use compiled `script.json` — only recompile when `test.md` changes |
| Discard test results            | Store results in `_reports/{timestamp}/` with screenshots           |

## Example Usage

When the user asks:

- `run e2e for extensions` → Discover `src/apps/extensions/e2e/**/test.md` and execute all
- `run e2e for oauth-google` → Discover `src/extensions/oauth-google-plugin/e2e/**/test.md` and execute
- `run e2e for posts` → Discover `src/extensions/posts-module/e2e/**/test.md` and execute
- `run the login tests for quick-access` → Run `src/extensions/quick-access-plugin/e2e/login/*/test.md`
- `run API tests for quick-access` → Run `node tools/e2e/runner.js quick-access-plugin/api`
- `run the auth API tests` → Run `node tools/e2e/runner.js quick-access-plugin/api/auth`
- `compile e2e scripts` → Run `node tools/e2e/runner.js --mode=compile`
- `run all e2e tests` → Find ALL `e2e/` folders in both `src/apps/` and `src/extensions/`, run each
- `/test-e2e` → Same as "run all e2e tests"

## Where test cases live

Test cases live inside their **own module or extension** — in an `e2e/` subdirectory:

```
src/
├── apps/                               ← Core modules
│   ├── extensions/
│   │   └── e2e/                        ← Extension manager lifecycle tests
│   ├── users/
│   │   └── e2e/                        ← User auth & management tests
│   └── ...
│
├── extensions/                         ← Installed extensions
│   ├── oauth-google-plugin/
│   │   └── e2e/                        ← Google OAuth flow tests
│   ├── posts-module/
│   │   └── e2e/                        ← Post CRUD tests
│   ├── profile-plugin/
│   │   └── e2e/                        ← Profile edit tests
│   ├── quick-access-plugin/
│   │   └── e2e/                        ← Quick login tests
│   └── ...
```

### Discovery command

To find ALL modules and extensions with e2e tests:

```bash
find src/apps src/extensions -type d -name "e2e" 2>/dev/null | sort
```

## Excel Import (for QA Teams)

QA testers can write test cases in Excel and convert them to `test.md` files automatically.

### Excel template

Generate a template with sample data and an Instructions sheet:

```bash
npm run test:e2e:template
# Output: tools/e2e/test-cases-template.xlsx
```

### Excel format

| Column | Header        | Required | Description                                       |
| ------ | ------------- | -------- | ------------------------------------------------- |
| A      | Test ID       | Yes      | Unique ID, e.g. `TC-QA-001`, `TC-API-002`         |
| B      | Module        | Yes      | Module/extension name, e.g. `quick-access-plugin` |
| C      | Type          | No       | `ui` (default), `api`, or `system`                |
| D      | Category      | Yes      | Test category, e.g. `login`, `auth`               |
| E      | Title         | Yes      | Test case title (becomes `# Heading`)             |
| F      | Description   | No       | Description paragraph                             |
| G      | Prerequisites | No       | Semicolon-separated `key=value` pairs             |
| H-Q    | Step 1-10     | Yes (1+) | Steps in natural English                          |
| R-V    | Expected 1-5  | No       | Acceptance criteria                               |
| W      | Priority      | No       | High / Medium / Low (metadata)                    |
| X      | Status        | No       | Draft / Ready / Automated (metadata)              |

**Prerequisites format:** `email=admin@example.com; password=admin123; role=admin`

### Convert Excel to test.md

```bash
# Preview what would be created (safe, no files written)
npm run test:e2e:import -- my-tests.xlsx --dry-run

# Create the test.md files
npm run test:e2e:import -- my-tests.xlsx

# Overwrite existing test.md files
npm run test:e2e:import -- my-tests.xlsx --force
```

### Full QA workflow

```
1. QA opens tools/e2e/test-cases-template.xlsx in Excel
2. Fills in test cases (one row per test)
3. Saves as my-tests.xlsx
4. Runs: npm run test:e2e:import -- my-tests.xlsx --dry-run
5. Reviews the output paths
6. Runs: npm run test:e2e:import -- my-tests.xlsx
7. Runs: npm run test:e2e  (compiles via LLM + executes)
8. Reviews results in e2e/{type}/{category}/{case}/_reports/
```

> [!TIP]
> The converter auto-detects whether a module lives in `src/apps/` or `src/extensions/`.
> UI tests (`type=ui`) place files directly under `e2e/{category}/` (no `ui/` prefix) for backward compatibility.
