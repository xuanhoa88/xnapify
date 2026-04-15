# E2E Test Framework

Compile-once, run-many test automation that transforms natural-language markdown test cases into executable Puppeteer/HTTP scripts via LLM interpretation.

## Quick Start

```bash
# Auto mode: compile if needed, then run
npm run test:e2e

# Visible browser
npm run test:e2e:headed

# Run a specific module
npm run test:e2e -- extensions
npm run test:e2e -- quick-access-plugin

# Run a specific category or test case
npm run test:e2e -- extensions/install
npm run test:e2e -- quick-access-plugin/login/01-buttons-visible

# Filter by glob pattern
npm run test:e2e -- --filter="**/login/**"
npm run test:e2e -- --filter="**/api/**"

# Compile only (no browser, no execution)
npm run test:e2e -- --mode=compile

# Run from compiled scripts only (no LLM calls)
npm run test:e2e -- --mode=run

# Force recompile
npm run test:e2e -- --mode=compile --force

# Run modules in parallel
npm run test:e2e -- --parallel

# Combine flags
npm run test:e2e -- --parallel --filter="**/login/**" --headed
```

> **Important:** Always use `npm run test:e2e` — never `node tools/e2e/runner.js` directly.
> The npm script pipeline loads `.env` config via `dotenv-flow` before execution.

## Architecture

```
npm run test:e2e
  → tools/run.js          (loads dotenv-flow, sets NODE_ENV)
    → tools/tasks/e2e.js  (sets E2E_VIA_TASK, spawns runner)
      → tools/e2e/runner.js  (orchestrates everything below)

┌─────────────────────────────────────────────────────┐
│                    runner.js                         │
│  CLI parser · browser lifecycle · module orchestrator│
├──────────┬──────────┬──────────┬───────────┬────────┤
│parser.js │compiler.js│executor.js│browser.js│reporter│
│ md → AST │ LLM cache │ actions  │ puppeteer │ results│
│          │           │          │           │        │
│          │  llmInter │          │           │        │
│          │  preter.js│          │           │        │
└──────────┴──────────┴──────────┴───────────┴────────┘
```

| File                | Lines | Responsibility                                                       |
| ------------------- | ----: | -------------------------------------------------------------------- |
| `runner.js`         |  ~690 | CLI entry, orchestrator, module execution loop                       |
| `executor.js`       | ~1130 | 19 action handlers, SPA stability engine                             |
| `llmInterpreter.js` |  ~575 | Multi-provider LLM client (OpenAI, Anthropic, Google, Ollama, stdin) |
| `parser.js`         |  ~323 | Markdown AST parser, test discovery, type detection                  |
| `excelToMd.js`      |  ~325 | Excel → test.md converter for QA teams                               |
| `createTemplate.js` |  ~284 | Excel template generator with sample data                            |
| `compiler.js`       |  ~290 | Compile/cache/archive test scripts                                   |
| `reporter.js`       |  ~175 | Result & summary report writer                                       |
| `browser.js`        |  ~130 | Puppeteer abstraction layer                                          |

## Test Types

Test type is auto-detected from directory structure:

| Directory                       | Type      | Browser? | Speed |
| ------------------------------- | --------- | -------- | ----- |
| `e2e/{category}/{case}/`        | 🌐 UI     | Yes      | ~12s  |
| `e2e/ui/{category}/{case}/`     | 🌐 UI     | Yes      | ~12s  |
| `e2e/api/{category}/{case}/`    | 🔌 API    | No       | ~0.5s |
| `e2e/system/{category}/{case}/` | 🔗 System | Yes      | ~12s  |

API tests are ~25x faster — use them for endpoint validation, auth flows, and RBAC checks.

## Test Case Format

Each test case is a `test.md` file in a numbered directory:

```
src/extensions/quick-access-plugin/e2e/
├── login/
│   ├── 01-buttons-visible/
│   │   ├── test.md          ← You write this
│   │   ├── script.json      ← LLM generates this
│   │   ├── .test-hash       ← Change detection (gitignored)
│   │   ├── _scripts/         ← Archived old scripts
│   │   └── _results/        ← Test run reports
│   └── 02-demo-login/
│       └── test.md
└── api/
    └── auth/
        └── 01-login-jwt/
            └── test.md
```

### UI test.md

```markdown
---
email: admin@example.com
password: admin123
role: admin
---

# Quick Access Buttons Visible on Login Page

Verify that quick-access login buttons are rendered on the login page.

### Prerequisite

- fixture_zip: ./src/__tests__/fixtures/sample-extension.zip

## Steps

1. Navigate to the login page
2. Wait for the page to fully load
3. Verify the "Admin User" button is visible
4. Verify the "Demo User" button is visible

## Expected Results

- The login page loads without errors
- Both quick-access buttons are visible and clickable
```

### API test.md

```markdown
---
email: admin@example.com
password: admin123
---

# Login API Returns Valid JWT

## Steps

1. Send POST request to /api/auth/login with email and password
2. Assert response status is 200
3. Assert response body contains "accessToken" field
4. Use the token to send GET request to /api/auth/profile
5. Assert response status is 200

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
```

### Syntax Reference

| Element                   | Meaning                                  |
| ------------------------- | ---------------------------------------- |
| YAML front-matter (`---`) | Credentials and metadata                 |
| `# Heading`               | Test case title (one per file)           |
| Paragraph text            | Description (not executed)               |
| `### Prerequisite`        | Per-test overrides (fixture paths, etc.) |
| `## Steps`                | Executable actions (numbered list)       |
| `## Expected Results`     | Acceptance criteria (bullet list)        |

## How Compilation Works

```
test.md  →  parser.js  →  compiler.js  →  llmInterpreter.js  →  script.json
                              ↑                                       ↓
                         .test-hash (SHA256)                   Committed to git
```

| Scenario                         | LLM called?                                      |
| -------------------------------- | ------------------------------------------------ |
| First run (no `script.json`)     | ✅ Yes                                           |
| Subsequent runs (hash matches)   | ❌ No — uses cached `script.json`                |
| `test.md` edited (hash mismatch) | ✅ Yes — archives old script, recompiles         |
| `--mode=compile --force`         | ✅ Yes — force recompile                         |
| Step fails at runtime            | ✅ Yes — recompiles that step only, retries once |

Compiled scripts are committed to git — teammates run tests without needing LLM API keys.

## CLI Flags

| Flag              | Description                                         |
| ----------------- | --------------------------------------------------- |
| `--headed`        | Show the browser window (default: headless)         |
| `--force`         | Force recompile even if `test.md` hasn't changed    |
| `--mode=compile`  | Compile test scripts via LLM only (no execution)    |
| `--mode=run`      | Run from compiled scripts only (no LLM calls)       |
| `--filter=<glob>` | Filter test files by glob pattern                   |
| `--parallel`      | Run modules concurrently, each with its own browser |

## Environment Variables

| Variable           | Description                                                          |
| ------------------ | -------------------------------------------------------------------- |
| `XNAPIFY_PORT`     | App port (auto-detected from `.env`, default: `1337`)                |
| `E2E_PORT`         | App port override (fallback after `XNAPIFY_PORT`)                    |
| `E2E_HEADLESS`     | `false` to show browser (prefer `--headed` flag)                     |
| `E2E_FIXTURE_ZIP`  | Path to test extension `.zip` for install tests                      |
| `E2E_EMAIL`        | Login email fallback (prefer YAML front-matter)                      |
| `E2E_PASSWORD`     | Login password fallback (prefer YAML front-matter)                   |
| `E2E_LLM_PROVIDER` | `auto`, `stdin`, `openai`, `anthropic`, `google`, `ollama`, `custom` |
| `E2E_LLM_API_KEY`  | Override auto-detected API key                                       |
| `E2E_LLM_MODEL`    | Model name override                                                  |
| `E2E_LLM_BASE_URL` | Base URL for custom LLM provider                                     |
| `E2E_OLLAMA_HOST`  | Ollama host override (fallback: `XNAPIFY_HOST` or `127.0.0.1`)       |
| `E2E_OLLAMA_PORT`  | Ollama port override (fallback: `11434`)                             |
| `E2E_DEBUG`        | `true` to show SPA stability diagnostics                             |
| `E2E_VIA_TASK`     | Internal — set by `tools/tasks/e2e.js` to authorize execution        |

## SPA Stability Engine

The executor uses a 5-signal convergence engine to determine when a page is ready:

1. **Network** — No pending XHR/fetch requests
2. **DOM** — No DOM mutations in the settle window
3. **Animations** — No running CSS animations on interactive elements
4. **Loading UI** — No spinners, skeletons, or progress bars visible
5. **React internals** — No pending React Suspense boundaries

This eliminates brittle `sleep()` timers and makes tests reliable across varying server response times.

## Available Actions

### UI Actions

| Action               | Description                                        |
| -------------------- | -------------------------------------------------- |
| `navigate`           | Go to a URL                                        |
| `click`              | Click an element (by selector, text, or container) |
| `type`               | Type text into an input field                      |
| `select`             | Select a dropdown option                           |
| `login`              | Full login flow (navigate, fill form, submit)      |
| `upload_file`        | Upload a file to a file input                      |
| `scroll`             | Scroll to an element or position                   |
| `wait`               | Wait for a duration                                |
| `wait_for_text`      | Wait for specific text to appear                   |
| `reload`             | Refresh the page                                   |
| `screenshot`         | Take a screenshot                                  |
| `assert_visible`     | Assert element/text is visible                     |
| `assert_not_visible` | Assert element/text is NOT visible                 |
| `assert_text`        | Assert element contains text                       |
| `assert_checked`     | Assert checkbox/toggle state                       |
| `confirm_modal`      | Click confirm button in a modal dialog             |
| `context_menu`       | Right-click and select from context menu           |

### API Actions

| Action          | Description                                              |
| --------------- | -------------------------------------------------------- |
| `api_request`   | Send HTTP request (GET, POST, PUT, DELETE)               |
| `assert_status` | Check response status code                               |
| `assert_body`   | Check JSON response fields                               |
| `assert_header` | Check response headers                                   |
| `store_value`   | Save a response value for reuse                          |
| `set_header`    | Set persistent header (supports `{{var}}` interpolation) |

## Excel Import (QA Teams)

```bash
# Generate template with sample data
npm run test:e2e:template

# Preview conversion (dry run)
npm run test:e2e:import -- my-tests.xlsx --dry-run

# Create test.md files
npm run test:e2e:import -- my-tests.xlsx

# Overwrite existing
npm run test:e2e:import -- my-tests.xlsx --force
```

Excel columns (A–K): Test ID, Module, Type, Category, Title, Description, Prerequisites, Steps, Expected, Priority, Status.

## Results

Each test run produces:

```
e2e/{category}/{case}/_results/{timestamp}/
├── result.md        ← Structured pass/fail report (committed)
├── step-01.png      ← Per-step screenshots (gitignored)
├── step-02.png
├── final.png        ← Final state screenshot (gitignored)
└── recording.webp   ← Video evidence (gitignored)

e2e/_results/{timestamp}/
└── _summary.md      ← Module-level summary table (committed)
```

## Where Test Cases Live

```
src/
├── apps/                          ← Core modules
│   ├── extensions/e2e/            ← Extension lifecycle tests
│   └── users/e2e/                 ← User auth tests
└── extensions/                    ← Installed extensions
    ├── quick-access-plugin/e2e/   ← Quick login tests
    ├── posts-module/e2e/          ← Post CRUD tests
    └── profile-plugin/e2e/        ← Profile edit tests
```

Discover all modules with e2e tests:

```bash
find src/apps src/extensions -type d -name "e2e" 2>/dev/null | sort
```
