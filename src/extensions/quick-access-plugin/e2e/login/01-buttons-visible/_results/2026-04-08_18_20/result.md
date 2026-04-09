# Quick Access Buttons Visible on Login Page

**Source:** src/extensions/quick-access-plugin/e2e/login/01-buttons-visible/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:29:46.071Z
**Result:** ✅ PASS
**Duration:** 18739ms

## Steps Executed

1. ✅ Navigate to the login page — navigate: Navigate to the login page
2. ✅ Wait for the page to fully load — wait_for_navigation: Wait for a full page navigation to complete
3. ✅ Verify the quick access login buttons are visible below the login form — assert_visible: Verify the Quick Access section is visible below the login form
4. ✅ Verify the "Admin User" button is visible — assert_visible: Verify the 'Admin User' button is visible
5. ✅ Verify the "John Doe" button is visible — assert_visible: Verify the 'John Doe' button is visible
6. ✅ Verify the "Jane Smith" button is visible — assert_visible: Verify the 'Jane Smith' button is visible

## Expected Results

- The login page loads with Email and Password fields and a "Log in" button
- A "Quick Access" section is visible below the login form
- Three demo account buttons are displayed: "Admin User", "John Doe", "Jane Smith"
- Each button shows the user's role label (Administrator, Editor, Viewer)
- Each button shows a hotkey number (1, 2, 3)

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
