# Verify Uninstalled Extension is Gone After Refresh

**Source:** src/apps/extensions/e2e/uninstall/02-verify-persists/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T04:35:21.233Z
**Result:** ❌ FAIL
**Duration:** 31655ms

## Steps Executed

1. ❌ Log in as admin — Navigation timeout of 30000 ms exceeded

## Expected Results

- The extensions admin page reloads completely after refresh
- The previously uninstalled extension card does NOT appear in the grid
- The total extension count remains decreased
- No error messages are shown related to the removed extension

## Notes

Navigation timeout of 30000 ms exceeded

## Evidence

### Screenshots

- [final.png](./final.png)
