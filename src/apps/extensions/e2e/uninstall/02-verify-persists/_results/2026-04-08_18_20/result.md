# Verify Uninstalled Extension is Gone After Refresh

**Source:** src/apps/extensions/e2e/uninstall/02-verify-persists/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:26:07.453Z
**Result:** ✅ PASS
**Duration:** 28208ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Refresh the page — reload: Refresh the current page
4. ✅ Wait for the extension cards to load — wait_for_selector: Wait for the extension cards to load and be visible
5. ✅ Verify the uninstalled extension card is no longer visible — assert_not_visible: Verify the uninstalled extension card is NOT present or visible on the page

## Expected Results

- The extensions admin page reloads completely after refresh
- The previously uninstalled extension card does NOT appear in the grid
- The total extension count remains decreased
- No error messages are shown related to the removed extension

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
