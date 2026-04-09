# Deactivate Extension via Toggle Switch

**Source:** src/apps/extensions/e2e/deactivate/01-toggle/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T04:11:46.515Z
**Result:** ❌ FAIL
**Duration:** 27169ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Find an active extension card with selector `.active-extension-card` — assert_visible: Verify that the active extension card is visible on the page
4. ✅ Click the toggle switch label inside that active extension card — click_within: Click the toggle switch within the active extension card
5. ✅ Confirm the "Deactivate Extension" modal — confirm_modal: Click the confirm/primary button in the visible modal dialog
6. ✅ Observe the action tag changes to "Deactivating..." with a shimmer animation — screenshot: Take a screenshot to observe the action tag changes to 'Deactivating...' with a shimmer animation
7. ✅ Wait for the success toast "Extension deactivated successfully" — wait_for_text: Wait for success toast indicating the extension has been deactivated.
8. ❌ Verify the checkbox inside the active extension card is now unchecked — Checkbox IS checked (expected unchecked)

## Expected Results

- An active extension card is found with its toggle switch in the on position
- A confirmation modal titled "Deactivate Extension" appears after clicking the toggle
- The action tag shows "Deactivating..." with a shimmer animation during deactivation
- A success toast "Extension deactivated successfully" appears
- The toggle switch transitions to the unchecked (off) position
- The extension card indicates the extension is now inactive

## Notes

Checkbox IS checked (expected unchecked)

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
