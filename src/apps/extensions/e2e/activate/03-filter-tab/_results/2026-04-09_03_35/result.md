# Verify Activated Extension Appears in Active Filter Tab

**Source:** src/apps/extensions/e2e/activate/03-filter-tab/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T03:37:09.548Z
**Result:** ❌ FAIL
**Duration:** 69012ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Click the "Active" filter tab — click: Click the 'Active' filter tab
4. ✅ Verify an element with selector `.active-extension-card` is visible in the filtered list — assert_visible: Verify the activated extension card is visible in the filtered list
5. ❌ Verify the badge count on the "Active" tab includes this extension — Text "badge count" not visible on page

## Expected Results

- The "Active" filter tab is clickable and highlights when selected
- The activated extension card is visible in the filtered list
- Only active extensions are shown when the "Active" tab is selected
- The badge count on the "Active" tab reflects the correct number of active extensions

## Notes

Text "badge count" not visible on page

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [step-03.png](./step-03.png)
- [step-04.png](./step-04.png)
