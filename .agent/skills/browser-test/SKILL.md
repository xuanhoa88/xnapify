---
name: browser-test
description: Browser automation testing using the AI agent's browser tools. Guides agents on navigating, interacting with, and visually verifying the running dev app.
allowed-tools: Browser, Read
version: 2.0
---

# Browser Automation Test Skill

You are performing **visual or functional browser tests** on the running `xnapify` application using your browser automation capability.

> [!TIP]
> For **E2E lifecycle tests**, see the `/run-e2e` workflow which reads `.md` test case files from each module's `e2e/` directory and uses this skill's rules to execute them.

---

## Port Discovery (MANDATORY — Do This First)

> [!CAUTION]
> The port is **NOT** 3000. It is configured via `XNAPIFY_PORT` in `.env` and can be **overridden** by environment-specific files (`.env.development`, `.env.local`, etc.).

**Resolution order:**

| Priority | Source | How |
|----------|--------|-----|
| 1 | User context | Check running terminal outputs for `localhost:XXXX` — this is always the **actual** running port |
| 2 | `.env` files | `grep XNAPIFY_PORT .env .env.* 2>/dev/null` — use the **last** match (env-specific files override base) |
| 3 | Default fallback | `1337` |

> 🔴 **NEVER guess or assume port 3000.** Always resolve from user context or `.env` files first.

---

## Browser Test Execution

Use your IDE's browser automation capability (e.g., `browser_subagent`, `browser_action`, browser tool, MCP browser, etc.) to perform tests.

### What to include in each browser task

| Field | Description |
|-------|-------------|
| **URL** | Full URL with correct port, e.g. `http://localhost:1337/admin/extensions` |
| **Steps** | Numbered, specific actions (click X, wait for Y, verify Z) |
| **Return condition** | What to report back (screenshot, text content, pass/fail) |
| **Recording/Screenshot** | Always capture visual evidence of the final state |

### Task prompt template

```
Navigate to http://localhost:{PORT}/{path}.

Steps:
1. Wait for the page to fully load (look for [specific element]).
2. [Action] — click/type/scroll on [specific element].
3. [Verify] — confirm [expected outcome].
4. Take a screenshot of the result.

Return: Describe what you observed — did [expected behavior] occur? Include any error messages.
```

---

## Common Test Patterns

### 1. Visual Verification (CSS / Animation)

```
Navigate to http://localhost:{PORT}/admin/extensions.
1. Wait for extension cards to load.
2. Click the action menu on any extension card.
3. Click "Activate" to open the confirm modal.
4. Click the "Activate" confirm button.
5. IMMEDIATELY observe the button text — it should change to "Activating..." with a shimmer animation.
6. Wait 600ms and observe the modal closing.
Return: Did the button text change to "Activating..." with shimmer? Was it visible for at least 600ms?
```

### 2. Form Submission Flow

```
Navigate to http://localhost:{PORT}/{form-page}.
1. Wait for the form to render.
2. Fill in [field] with [value] using keyboard typing.
3. Click [submit button].
4. Observe loading state on the submit button.
5. Wait for success/error response.
Return: Describe the form submission result — success message, error, or redirect.
```

### 3. Navigation / Routing

```
Navigate to http://localhost:{PORT}/{start-page}.
1. Wait for page load.
2. Click [nav element / link].
3. Verify the URL changed to [expected URL].
4. Verify [expected content] is visible on the new page.
Return: Did navigation work correctly? What URL and content appeared?
```

### 4. Error State Verification

```
Navigate to http://localhost:{PORT}/{page}.
1. [Trigger error condition] — e.g., submit invalid data.
2. Observe error message/banner.
3. Take screenshot of the error state.
Return: What error message appeared? Where was it displayed?
```

### 5. E2E Lifecycle Test (from `.md` file)

When executing test cases from `/run-e2e`, inject the parsed steps:

```
Navigate to http://localhost:{PORT}/admin/{module-page}.

Steps:
1. Wait for the page to fully load (look for the page header or main content).
2. {step 1 from the .md file}
3. {step 2 from the .md file}
...
N. Take a screenshot of the final state.

Return: Describe what happened at each step. Did all steps succeed?
Report any errors, unexpected UI states, or missing elements.
```

---

## Rules

| Rule | Description |
|------|-------------|
| **Port first** | Always resolve port before building URLs |
| **Be specific** | Use exact text, CSS selectors, or element descriptions |
| **One flow per call** | Test ONE user flow per browser automation call |
| **Screenshot proof** | Always request screenshots for visual verification |
| **Wait for load** | Always include "wait for page to load" as step 1 |
| **Auth first** | If page requires login, handle auth in a dedicated step first |
| **No guessing** | Ask the user for credentials / URLs if not known |

---

## Handling Auth

If the page redirects to login:

1. Navigate to `/login`, fill admin credentials, submit
2. Wait for redirect to the authenticated page
3. If no credentials are known, **ask the user** — never guess passwords
4. Reuse the browser session for subsequent tests (don't re-login each time)

---

## Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|------|
| Hardcode port 3000 | Read XNAPIFY_PORT from .env |
| Test multiple flows in one call | One flow per browser automation call |
| Skip wait for page load | Always wait for specific elements |
| Use vague element descriptions | Use exact text, IDs, or roles |
| Ignore login/auth redirects | Handle auth flow first |
| Guess admin passwords | Ask the user if credentials are not known |
