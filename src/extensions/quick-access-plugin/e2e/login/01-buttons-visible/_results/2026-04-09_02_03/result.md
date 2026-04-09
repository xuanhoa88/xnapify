# Quick Access Buttons Visible on Login Page

**Source:** src/extensions/quick-access-plugin/e2e/login/01-buttons-visible/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:12:27.258Z
**Result:** ❌ FAIL
**Duration:** 2624ms

## Steps Executed

1. ❌ Navigate to the login page — net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/login

## Expected Results

- The login page loads with Email and Password fields and a "Log in" button
- A "Quick Access" section is visible below the login form
- Three demo account buttons are displayed: "Admin User", "John Doe", "Jane Smith"
- Each button shows the user's role label (Administrator, Editor, Viewer)
- Each button shows a hotkey number (1, 2, 3)

## Notes

net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/login

## Evidence

### Screenshots

- [final.png](./final.png)
