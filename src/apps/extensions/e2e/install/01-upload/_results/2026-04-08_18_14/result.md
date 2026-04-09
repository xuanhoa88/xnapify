# Upload Extension Package

**Source:** src/apps/extensions/e2e/install/01-upload/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:18:12.985Z
**Result:** ❌ FAIL
**Duration:** 36642ms

## Steps Executed

1. ❌ Log in as admin — Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Expected Results

- The extensions admin page loads with an "Upload Extension" button
- A file picker dialog appears when clicking upload
- After selecting the zip file, a confirmation modal is displayed
- A success toast "Extension installed successfully" appears after installation
- The new extension card is visible in the extensions grid with its name and version

## Notes

Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Evidence

### Screenshots

- [final.png](./final.png)
