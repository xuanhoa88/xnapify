# Deactivate Extension via Toggle Switch

**Source:** src/apps/extensions/e2e/deactivate/01-toggle/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T04:00:55.870Z
**Result:** ❌ FAIL
**Duration:** 22904ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Find an active extension card with selector `.active-extension-card` — assert_visible: Verify that the active extension card is visible on the page
4. ❌ Click the toggle switch label inside that active extension card — Node is either not clickable or not an Element

## Expected Results

- An active extension card is found with its toggle switch in the on position
- A confirmation modal titled "Deactivate Extension" appears after clicking the toggle
- The action tag shows "Deactivating..." with a shimmer animation during deactivation
- A success toast "Extension deactivated successfully" appears
- The toggle switch transitions to the unchecked (off) position
- The extension card indicates the extension is now inactive

## Notes

Node is either not clickable or not an Element

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [step-03.png](./step-03.png)
