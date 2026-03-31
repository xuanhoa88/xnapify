---
description: Run E2E test cases from a module's e2e/ folder using AI agent browser automation
---

Run browser-based E2E tests by reading natural language test cases from `.md` files colocated inside each module's `e2e/` directory.

## Quick Start (CLI)

The primary way to run E2E tests is via the **Chromium CLI tool**:

```bash
# Run ALL e2e tests (headless Chromium)
npm run test:e2e

# Run with visible browser
npm run test:e2e:headed

# Run a specific module
node tools/e2e/runner.js extensions

# Run a specific extension
node tools/e2e/runner.js posts-module

# Run a specific test file
node tools/e2e/runner.js extensions/02-activate

# Clear LLM step cache before running
node tools/e2e/runner.js --clear-cache
```

> [!TIP]
> Credentials are defined per-test in YAML front-matter. No env vars needed for auth!
> LLM auto-detects from existing IDE API keys (`GEMINI_API_KEY`, `OPENAI_API_KEY`, etc.)

**Environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `E2E_PORT` | No | App port (auto-detected from `.env`, default: `1337`) |
| `E2E_HEADLESS` | No | `false` to show browser (default: `true`) |
| `E2E_FIXTURE_ZIP` | No | Path to test extension `.zip` for install tests |
| `E2E_EMAIL` | No | Login email fallback (prefer YAML front-matter in test files) |
| `E2E_PASSWORD` | No | Login password fallback (prefer YAML front-matter in test files) |
| `E2E_LLM_PROVIDER` | No | `auto` (default), `stdin`, `openai`, `anthropic`, `google`, `ollama`, `custom` |
| `E2E_LLM_API_KEY` | No | Override auto-detected API key |
| `E2E_LLM_MODEL` | No | Model name override (each provider has a default) |
| `E2E_LLM_BASE_URL` | No | Base URL override (for custom/ollama) |
| `E2E_DEBUG` | No | `true` to show SPA stability diagnostics |

## How it works

The CLI tool (`tools/e2e/runner.js`) uses **Puppeteer + Chromium** to:
1. Discover `.md` test files in `e2e/` directories
2. Parse YAML front-matter (credentials) + markdown AST (test steps) via `front-matter` + `markdown-it`
3. Auto-detect an LLM provider from IDE/CLI env vars (or use `stdin` for agent callback)
4. Send each English step to the LLM for interpretation into a structured JSON action
5. Execute the action via Puppeteer with SPA stability detection (5-signal engine)
6. Take screenshots, write per-test results and `_summary.md`

This works from **any terminal, any IDE, any CI/CD pipeline**.

## AI Agent Fallback

If the CLI tool doesn't support a specific step pattern, or for exploratory testing,
AI agents can also execute `.md` test cases directly using their browser automation:

> [!IMPORTANT]
> Read the `browser-test` skill (`view_file .agent/skills/browser-test/SKILL.md`) for port discovery, task formatting, and auth handling rules.

## Test Case Format

Each `.md` file in a module's `e2e/` directory follows this structure:

```markdown
---
email: admin@test.com
password: admin123
role: admin
---

# Phase Name (e.g., "Activate Extension")

Optional description of what this phase tests.

## Test Case Title

### Prerequisite

- fixture_zip: ./test-fixtures/sample-extension.zip

1. Log in as admin
2. Navigate to the extensions admin page
3. Step instruction in natural English
4. ...

## Another Test Case (inherits YAML front-matter credentials)

1. ...
```

- **YAML front-matter** (`---`) = File-level prerequisites (shared across all tests)
- **H1 (`#`)** = Test phase / suite name
- **H2 (`##`)** = Individual test case
- **H3 `### Prerequisite`** = Per-test overrides (merged with front-matter)
- **Bullet list** under `### Prerequisite` = Key-value pairs (`key: value`)
- **Numbered list (`1.`, `2.`, ...)** = Steps to execute in order
- **Paragraph text** = Context/description (not executed)

## Execution Steps

### 1. Resolve the port (MANDATORY)

Follow the `browser-test` skill port discovery rules — same priority order:

| Priority | Source | How |
|----------|--------|-----|
| 1 | User context | Check running terminal outputs for `localhost:XXXX` |
| 2 | `.env` files | `grep XNAPIFY_PORT .env .env.* 2>/dev/null` — use the **last** match |
| 3 | Default fallback | `1337` |

> [!CAUTION]
> **NEVER** guess or assume port 3000. Always resolve from user context or `.env` files first.

// turbo
### 2. Discover test case files

Find all `.md` files in the target module or extension's `e2e/` directory.

**For a specific module or extension:**
```bash
# Core module (e.g., extensions, users)
find src/apps/{module}/e2e -name "*.md" -type f 2>/dev/null | sort

# Installed extension (e.g., posts-module, oauth-google-plugin)
find src/extensions/{extension}/e2e -name "*.md" -type f 2>/dev/null | sort
```

**For ALL e2e tests across the project:**
```bash
find src/apps src/extensions -type d -name "e2e" -exec find {} -name "*.md" -type f \; 2>/dev/null | sort
```

Sort by filename prefix (e.g., `01-install.md`, `02-activate.md`) to get lifecycle order.

### 3. Read and parse each test case file

Use your file reading tool to read each `.md` file. Parse into structured data:
- **H1 line** → Phase / suite name
- **H2 lines** → Individual test case names
- **Numbered list items** → Steps for that test case
- **Non-heading, non-list paragraphs** → Description (skip during execution)

### 4. Handle authentication FIRST

Before executing any test case, ensure the browser is authenticated.

Follow the `browser-test` skill auth rules:
1. Open the browser to the target admin page
2. If redirected to `/login`, fill in admin credentials and submit
3. Wait for redirect back to the authenticated page
4. Ask the user for credentials if not known — **do NOT guess passwords**
5. Keep the browser session open for subsequent tests

### 5. Create results directory

Before executing tests, create a timestamped results directory inside the module's `e2e/` folder:

```bash
# Format: e2e/results/YYYY-MM-DD_HH-MM/
mkdir -p src/apps/{module}/e2e/results/{timestamp}/
# or for extensions:
mkdir -p src/extensions/{extension}/e2e/results/{timestamp}/
```

Example: `src/apps/extensions/e2e/results/2026-03-31_10-03/`

### 6. Execute each test case

For each test case (H2 block), use your browser automation tool to execute **ONE test case at a time**.

Build the task from the parsed steps following the `browser-test` skill template:

```
Navigate to http://localhost:{PORT}/{admin-page}.

Steps:
1. Wait for the page to fully load (look for the page header or main content).
2. {step 1 from the .md file}
3. {step 2 from the .md file}
...
N. Take a screenshot of the final state.

Return: Describe what happened at each step. Did all steps succeed?
Report any errors, unexpected UI states, or missing elements.
```

### 7. Store individual test case results

After each test case completes, create a result file:

**Result file path:** `e2e/results/{timestamp}/{file_prefix}_{test_slug}.md`

Example: `e2e/results/2026-03-31_10-03/02_activate_toggle_switch.md`

**Result file format:**

```markdown
# {Test Case Title}

**Source:** {path to .md test case file}
**Date:** {ISO timestamp}
**Result:** ✅ PASS | ❌ FAIL

## Steps Executed

1. ✅ Navigate to extensions admin page — page loaded successfully
2. ✅ Find inactive extension card — found "oauth-google"
3. ✅ Click toggle switch — modal appeared
4. ✅ Confirm modal — "Activating..." tag shown
5. ✅ Wait for toast — "Extension activated successfully" appeared
6. ✅ Verify toggle checked — toggle is ON

## Notes

{Any observations, warnings, or failure details from the browser automation report}

## Evidence

- Video: [02_activate_toggle.webp](./02_activate_toggle.webp)
- Screenshot: [02_activate_toggle.png](./02_activate_toggle.png)
```

**Save evidence files:**
Copy any recordings or screenshots produced by your browser automation tool into the results folder.

### 8. Create summary report

After ALL test cases in a module are executed, create a summary file:

**Summary file path:** `e2e/results/{timestamp}/_summary.md`

**Summary format:**

```markdown
# E2E Test Results: {module or extension name}

**Date:** {ISO timestamp}
**Port:** {resolved port}
**Total:** {passed}/{total} passed
**Duration:** {total time}

## Results

| # | File | Test Case | Result | Evidence |
|---|------|-----------|--------|----------|
| 1 | 01-install | Upload valid package | ✅ PASS | [video](./01_install_upload.webp) |
| 2 | 01-install | Persist after refresh | ✅ PASS | [video](./01_install_persist.webp) |
| 3 | 02-activate | Toggle switch | ✅ PASS | [video](./02_activate_toggle.webp) |
| 4 | 03-deactivate | Toggle switch | ❌ FAIL | [video](./03_deactivate_toggle.webp) |

## Failed Tests

### 03-deactivate: Toggle switch
- **Expected:** Modal appears after clicking toggle
- **Actual:** No modal appeared, toggle state unchanged
- **Evidence:** [03_deactivate_toggle.webp](./03_deactivate_toggle.webp)
```

## Results Directory Structure

```
src/apps/extensions/e2e/
├── 01-install.md                           ← Test case definition (committed)
├── 02-activate.md
├── 03-deactivate.md
├── 04-upgrade.md
├── 05-uninstall.md
└── results/                                ← Test run results (committed as test history)
    ├── 2026-03-31_10-03/                   ← One directory per test run
    │   ├── _summary.md                     ← Overall run summary
    │   ├── 01_install_upload.md            ← Individual result + notes
    │   ├── 01_install_upload.webp          ← Video evidence
    │   ├── 02_activate_toggle.md
    │   ├── 02_activate_toggle.webp
    │   └── ...
    └── 2026-03-31_14-30/                   ← Another test run
        ├── _summary.md
        └── ...
```

## Rules

These rules extend the `browser-test` skill rules:

| Rule | Description |
|------|-------------|
| **Skill first** | Read `browser-test` skill before starting — it defines port discovery, task format, and auth handling |
| **Port first** | Resolve port using the 3-priority system before building any URL |
| **One flow per call** | Execute ONE test case (H2 block) per browser automation call |
| **Serial execution** | Run test cases in file order (01 → 02 → 03...) since later phases depend on earlier state |
| **Screenshot proof** | Always request a screenshot at the end of each test case |
| **Wait for load** | Always prepend "Wait for the page to fully load" as the first step |
| **Auth first** | Handle login before any test case |
| **Store results** | Write a result `.md` file + copy evidence for every test case |
| **Report clearly** | Create `_summary.md` with ✅/❌ table after all tests complete |
| **No guessing** | Ask the user for credentials / URLs if not known — never assume |

## Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|------|
| Hardcode port 3000 | Resolve via `.env` or user context |
| Test multiple H2 cases in one call | One browser automation call per H2 block |
| Skip page load wait | Always wait for specific content first |
| Use vague "click the button" | Use exact text: `Click the "Upload Extension" button` |
| Ignore auth redirects | Handle login in a dedicated pre-test step |
| Run tests in random order | Follow file prefix order (01 → 02 → 03...) |
| Guess admin passwords | Ask the user if credentials are not known |
| Only search `src/apps/` | Search BOTH `src/apps/` and `src/extensions/` for `e2e/` folders |
| Discard test results | Always write result files + copy evidence into results/ |

## Example Usage

When the user asks:
- `run e2e for extensions` → Read `src/apps/extensions/e2e/*.md` (core extensions manager) and execute all
- `run e2e for oauth-google` → Read `src/extensions/oauth-google-plugin/e2e/*.md` and execute
- `run e2e for posts` → Read `src/extensions/posts-module/e2e/*.md` and execute
- `run the activate test for extensions` → Read only `src/apps/extensions/e2e/02-activate.md`
- `run all e2e tests` → Find ALL `e2e/` folders in both `src/apps/` and `src/extensions/`, run each
- `/run-e2e` → Same as "run all e2e tests"

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
