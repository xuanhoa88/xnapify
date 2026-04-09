# Verify Deactivated Extension Moves to Inactive Filter

**Source:** src/apps/extensions/e2e/deactivate/02-filter-tab/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:08:00.434Z
**Result:** ✅ PASS
**Duration:** 54781ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Click the "Inactive" filter tab — click: Click the 'Inactive' filter tab
4. ✅ Verify an element with selector `.inactive-extension-card` is visible — assert_visible: Verify the inactive extension card is visible
5. ✅ Click the "Active" filter tab — click: Click the Active filter tab
6. ✅ Verify no elements with selector `.inactive-extension-card` are visible in the Active tab — assert_not_visible: Verify no elements with selector .inactive-extension-card are visible in the Active tab

## Expected Results

- The "Inactive" filter tab shows the deactivated extension card
- The "Active" filter tab does NOT show the deactivated extension card
- Filter tab badge counts update correctly after deactivation
- Switching between tabs correctly filters the extension grid

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
- [step-06.png](./step-06.png)
