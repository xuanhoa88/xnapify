# Uninstall an Inactive Extension

**Source:** src/apps/extensions/e2e/uninstall/01-remove/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:25:38.240Z
**Result:** ❌ FAIL
**Duration:** 63049ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ❌ Open the Inactive filter tab to show deactivated extensions — Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Expected Results

- The Inactive filter tab shows at least one deactivated extension
- An inactive extension card is found with a "Remove" button visible
- A confirmation modal titled "Uninstall Extension" appears after clicking Remove
- The action tag shows "Uninstalling..." during the removal process
- A success toast "Extension uninstalled successfully" appears
- The extension card is removed from the grid
- The total extension count decreases by one

## Notes

Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
