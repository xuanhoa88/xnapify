# Verify Activated Extension Persists After Refresh

**Source:** src/apps/extensions/e2e/activate/02-verify-persists/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:24:33.161Z
**Result:** ✅ PASS
**Duration:** 25475ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Refresh the page — reload: Refresh the current page
4. ✅ Wait for the extension cards to load — wait_for_selector: Wait for the extension cards to load and be visible
5. ✅ Verify an element with selector `.active-extension-card input[type="checkbox"]` is checked — assert_checked: Verify the toggle switch on the active extension is checked.

## Expected Results

- The extensions admin page reloads completely after refresh
- The previously activated extension remains visible
- The toggle switch on the active extension remains checked
- The extension status indicator shows it is still active

## Notes

All steps completed successfully.

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [step-03.png](./step-03.png)
- [step-04.png](./step-04.png)
- [step-05.png](./step-05.png)
