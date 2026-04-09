# Verify Installed Extension Persists After Refresh

**Source:** src/apps/extensions/e2e/install/02-verify-persists/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:49:05.241Z
**Result:** ✅ PASS
**Duration:** 70858ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Refresh the page — reload: Refresh the current page
4. ✅ Wait for the extension cards to load — wait_for_selector: Wait for the extension cards to load and be visible
5. ✅ Verify an element with selector `.extension-card` is visible — assert_visible: Verify an element with selector .extension-card is visible

## Expected Results

- The extensions admin page reloads completely after refresh
- All extension cards are re-rendered after the page refresh
- The previously installed extension card is still visible in the grid
- The extension's name, version, and status are unchanged

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
