# Quick Access Buttons Visible on Login Page

**Source:** src/extensions/quick-access-plugin/e2e/login/01-buttons-visible/test.md
**Date:** 2026-04-02T08:32:15.848Z
**Result:** ✅ PASS
**Duration:** 11130ms

## Steps Executed

1. ✅ Navigate to the login page — navigate: Open the login page
2. ✅ Wait for the page to fully load — wait: Wait for all resources to finish loading
3. ✅ Verify the quick access login buttons are visible below the login form — assert_visible: Check Admin User demo button is visible
4. ✅ Verify there are demo account buttons rendered by the extension slot — assert_visible: Check Jane Smith demo button is visible

## Expected Results

- The login page loads with Email and Password fields and a "Log in" button
- A "Quick Access" section is visible below the login form
- Three demo account buttons are displayed: "Admin User", "John Doe", "Jane Smith"
- Each button shows the user's role label (ADMINISTRATOR, EDITOR, VIEWER)
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
