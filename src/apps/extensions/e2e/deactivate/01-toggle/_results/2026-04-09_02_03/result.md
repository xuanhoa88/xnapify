# Deactivate Extension via Toggle Switch

**Source:** src/apps/extensions/e2e/deactivate/01-toggle/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:07:05.647Z
**Result:** ❌ FAIL
**Duration:** 62738ms

## Steps Executed

1. ❌ Log in as admin — Navigation timeout of 30000 ms exceeded

## Expected Results

- An active extension card is found with its toggle switch in the on position
- A confirmation modal titled "Deactivate Extension" appears after clicking the toggle
- The action tag shows "Deactivating..." with a shimmer animation during deactivation
- A success toast "Extension deactivated successfully" appears
- The toggle switch transitions to the unchecked (off) position
- The extension card indicates the extension is now inactive

## Notes

Navigation timeout of 30000 ms exceeded

## Evidence

### Screenshots

- [final.png](./final.png)
