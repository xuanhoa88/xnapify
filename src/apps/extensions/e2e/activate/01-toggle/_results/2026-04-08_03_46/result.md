# Activate Extension via Toggle Switch

**Source:** src/apps/extensions/e2e/activate/01-toggle/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T03:56:44.671Z
**Result:** ❌ FAIL
**Duration:** 603221ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using {{email}} and {{password}} from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to extensions admin page
3. ❌ Find an inactive extension card (toggle switch is unchecked) — Test execution timed out after 600s

## Expected Results

- An inactive extension card is found with its toggle switch in the off position
- A confirmation modal titled "Activate Extension" appears after clicking the toggle
- The action tag shows "Activating..." with a shimmer animation during activation
- A success toast "Extension activated successfully" appears
- The toggle switch transitions to the checked (on) position
- The extension card indicates the extension is now active

## Notes

Test execution timed out after 600s

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
