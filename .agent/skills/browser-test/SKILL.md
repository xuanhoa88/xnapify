---
name: browser-test
description: Browser automation testing using the browser_subagent tool. Guides agents on navigating, interacting with, and visually verifying the running dev app.
allowed-tools: Browser, Read
version: 1.0
---

# Browser Automation Test Skill

You are performing **visual or functional browser tests** on the running `rapid-rsk` application using the `browser_subagent` tool.

---

## Port Discovery (MANDATORY)

The app port is **NOT hardcoded to 3000**. You MUST resolve it:

| Priority | Source | Example |
|----------|--------|---------|
| 1 | `RSK_PORT` env var | Read from `.env` file |
| 2 | Running terminal metadata | Check user's running dev server URL |
| 3 | Default fallback | `1337` |

**Quick resolution:**
```
1. Check user metadata for "Running terminal commands" or "Browser State" — extract port from URL
2. If unavailable, read RSK_PORT from .env: grep RSK_PORT .env
3. Fallback: 1337
```

> 🔴 **NEVER assume port 3000.** Always resolve port first.

---

## browser_subagent Task Format

When calling `browser_subagent`, your `Task` prompt must include:

| Field | Description |
|-------|-------------|
| **URL** | Full URL with correct port, e.g. `http://localhost:1337/admin/plugins` |
| **Steps** | Numbered, specific actions (click X, wait for Y, verify Z) |
| **Return condition** | What to report back (screenshot, text content, pass/fail) |
| **Recording name** | Descriptive snake_case, max 3 words |

### Template

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
Navigate to http://localhost:{PORT}/admin/plugins.
1. Wait for plugin cards to load.
2. Click the action menu on any plugin card.
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
1. [Trigger error condition] — e.g., submit invalid data, disconnect network.
2. Observe error message/banner.
3. Take screenshot of the error state.
Return: What error message appeared? Where was it displayed?
```

---

## Rules

| Rule | Description |
|------|-------------|
| **Port first** | Always resolve port before building URLs |
| **Be specific** | Use exact text, CSS selectors, or element descriptions |
| **One flow per call** | Test ONE user flow per `browser_subagent` call |
| **Screenshot proof** | Always request screenshots for visual verification |
| **Wait for load** | Always include "wait for page to load" as step 1 |
| **Auth awareness** | If page requires login, handle auth first or note the redirect |

---

## Recording Names

Use descriptive `snake_case` names, max 3 words:

| Test Type | Example Name |
|-----------|-------------|
| Button loading state | `button_loading_test` |
| Form submission | `form_submit_flow` |
| Navigation check | `nav_routing_test` |
| Error handling | `error_state_check` |
| Plugin actions | `plugin_action_test` |

---

## Handling Auth

If the page redirects to login:

1. Check if there's a session cookie or dev login bypass
2. Try navigating to the login page first, fill credentials, submit
3. Then navigate to the target page
4. If no credentials are known, report and ask the user

---

## Anti-Patterns

| ❌ Don't | ✅ Do |
|----------|------|
| Hardcode port 3000 | Read RSK_PORT from .env |
| Test multiple flows in one call | One flow per browser_subagent call |
| Skip wait for page load | Always wait for specific elements |
| Use vague element descriptions | Use exact text, IDs, or roles |
| Ignore login/auth redirects | Handle auth flow first |
