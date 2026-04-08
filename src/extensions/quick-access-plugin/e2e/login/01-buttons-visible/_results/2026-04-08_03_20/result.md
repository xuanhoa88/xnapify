# Quick Access Buttons Visible on Login Page

**Source:** src/extensions/quick-access-plugin/e2e/login/01-buttons-visible/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T03:23:57.062Z
**Result:** ✅ PASS
**Duration:** 59703ms

## Steps Executed

1. ✅ Navigate to the login page — navigate: Navigate to the login page
2. ✅ Wait for the page to fully load — wait_for_selector: Wait for login email field to be visible
3. ✅ Verify the quick access login buttons are visible below the login form — assert_visible: Verify the Quick Access section is visible
4. ✅ Verify there are demo account buttons rendered by the extension slot — assert_visible: Verify Admin User demo button is rendered

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
