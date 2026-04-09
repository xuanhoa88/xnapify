# Verify Deactivated Extension Moves to Inactive Filter

**Source:** src/apps/extensions/e2e/deactivate/02-filter-tab/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:17:36.339Z
**Result:** ❌ FAIL
**Duration:** 36669ms

## Steps Executed

1. ❌ Log in as admin — Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Expected Results

- The "Inactive" filter tab shows the deactivated extension card
- The "Active" filter tab does NOT show the deactivated extension card
- Filter tab badge counts update correctly after deactivation
- Switching between tabs correctly filters the extension grid

## Notes

Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Evidence

### Screenshots

- [final.png](./final.png)
