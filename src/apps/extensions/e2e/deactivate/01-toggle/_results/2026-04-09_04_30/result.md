# Deactivate Extension via Toggle Switch

**Source:** src/apps/extensions/e2e/deactivate/01-toggle/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T04:32:51.005Z
**Result:** ❌ FAIL
**Duration:** 28745ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ❌ Find an active extension card with selector `.active-extension-card` — Element not found after retry timeout

## Expected Results

- An active extension card is found with its toggle switch in the on position
- A confirmation modal titled "Deactivate Extension" appears after clicking the toggle
- The action tag shows "Deactivating..." with a shimmer animation during deactivation
- A success toast "Extension deactivated successfully" appears
- The toggle switch transitions to the unchecked (off) position
- The extension card indicates the extension is now inactive

## Notes

Element not found after retry timeout

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
