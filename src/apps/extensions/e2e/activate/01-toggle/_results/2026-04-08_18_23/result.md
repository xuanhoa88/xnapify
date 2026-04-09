# Activate Extension via Toggle Switch

**Source:** src/apps/extensions/e2e/activate/01-toggle/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:24:07.681Z
**Result:** ❌ FAIL
**Duration:** 54999ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ❌ Wait for the extensions toolbar and card grid to load — Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Expected Results

- The extensions admin page loads successfully for admin users
- The Inactive filter tab displays deactivated extensions
- An inactive extension card is available with a Remove button or unchecked toggle
- Clicking the toggle opens the Activate Extension modal
- The extension becomes active after confirmation
- A success toast appears indicating the extension was activated
- The toggle switch remains checked after activation

## Notes

Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
