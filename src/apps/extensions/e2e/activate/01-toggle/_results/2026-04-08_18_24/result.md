# Activate Extension via Toggle Switch

**Source:** src/apps/extensions/e2e/activate/01-toggle/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:25:25.451Z
**Result:** ✅ PASS
**Duration:** 28580ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Wait for the extensions toolbar and card grid to load — wait_for_selector: Wait for the extensions toolbar and card grid to appear and be visible.
4. ✅ Open the Inactive filter tab to show deactivated extensions — click: Click the Inactive filter tab to show deactivated extensions
5. ✅ Find an inactive extension card with a visible "Remove" button or unchecked toggle — assert_visible: Verify that an inactive extension card with a visible 'Remove' button is present
6. ✅ Click the toggle switch label inside the first element with class `.inactive-extension-card` — click_within: Click the toggle switch label inside the first element with class '.inactive-extension-card'
7. ✅ Confirm the "Activate Extension" modal — confirm_modal: Click the confirm/primary button in the visible 'Activate Extension' modal dialog
8. ✅ Wait for the activation to complete and the success toast to appear — wait_for_text: Wait for success toast indicating the extension was activated

## Expected Results

- The extensions admin page loads successfully for admin users
- The Inactive filter tab displays deactivated extensions
- An inactive extension card is available with a Remove button or unchecked toggle
- Clicking the toggle opens the Activate Extension modal
- The extension becomes active after confirmation
- A success toast appears indicating the extension was activated
- The toggle switch remains checked after activation

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
