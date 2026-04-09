# Uninstall an Inactive Extension

**Source:** src/apps/extensions/e2e/uninstall/01-remove/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:11:13.747Z
**Result:** ✅ PASS
**Duration:** 25174ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Open the Inactive filter tab to show deactivated extensions — click: Click the Inactive filter tab to show deactivated extensions
4. ✅ Wait until an element with selector `.inactive-extension-card` is visible — wait_for_selector: Wait until an element with selector .inactive-extension-card is visible
5. ✅ Click the first "Remove" button shown in the inactive extensions list — click: Click the first 'Remove' button shown in the inactive extensions list
6. ✅ Confirm the "Uninstall Extension" modal — confirm_modal: Click the confirm/primary button in the visible modal dialog
7. ✅ Observe the action tag changes to "Uninstalling..." — screenshot: Take a screenshot to observe the action tag changes to 'Uninstalling...'
8. ✅ Wait for the success toast "Extension uninstalled successfully" — wait_for_text: Wait for success toast indicating the extension has been uninstalled successfully.
9. ✅ Verify the extension card is no longer visible in the grid — assert_not_visible: Verify the extension card is NOT present or visible on the page

## Expected Results

- The Inactive filter tab shows at least one deactivated extension
- An inactive extension card is found with a "Remove" button visible
- A confirmation modal titled "Uninstall Extension" appears after clicking Remove
- The action tag shows "Uninstalling..." during the removal process
- A success toast "Extension uninstalled successfully" appears
- The extension card is removed from the grid
- The total extension count decreases by one

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
- [step-07.png](./step-07.png)
- [step-08.png](./step-08.png)
- [step-09.png](./step-09.png)
