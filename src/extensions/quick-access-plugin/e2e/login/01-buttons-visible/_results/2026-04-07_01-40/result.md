# Quick Access Buttons Visible on Login Page

**Source:** src/extensions/quick-access-plugin/e2e/login/01-buttons-visible/test.md
**Type:** 🌐 UI
**Date:** 2026-04-07T01:40:00.000Z
**Result:** ✅ PASS
**Duration:** 12000

## Steps Executed

1. ✅ Wait for the page to fully load (look for the "Email" and "Password" labels). — navigate: Open login page
2. ✅ Look for a "Quick Access" section below the login form. — wait: Wait for quick access section
3. ✅ Verify that there are three buttons for "Admin User", "John Doe", and "Jane Smith". — assert_visible: Verify demo buttons
4. ✅ Check if these buttons have role labels (ADMINISTRATOR, EDITOR, VIEWER) and hotkeys (1, 2, 3). — assert_visible: Verify role labels and hotkeys
5. ✅ Take a screenshot of the login page showing the "Quick Access" buttons. — screenshot: Capture final state

## Expected Results

- The login page loads with Email and Password fields and a "Log in" button
- A "Quick Access" section is visible below the login form
- Three demo account buttons are displayed: "Admin User", "John Doe", "Jane Smith"
- Each button shows the user's role label (ADMINISTRATOR, EDITOR, VIEWER)
- Each button shows a hotkey number (1, 2, 3)

## Notes

Ran manually via AI Agent due to LLM provider unavailability. All elements rendered correctly.

## Evidence

### Screenshots

- [final.png](./final.png)

### Videos

- [recording.webp](./recording.webp)
