# Quick Login via Demo Account Button

**Source:** src/extensions/quick-access-plugin/e2e/login/02-demo-login/test.md
**Type:** 🌐 UI
**Date:** 2026-04-07T01:40:00.000Z
**Result:** ✅ PASS
**Duration:** 14000

## Steps Executed

1. ✅ Click the "Admin User" button in the "Quick Access" section. — click: Click Admin User demo button
2. ✅ Wait for the automatic login and redirect to the home page (http://localhost:1337/). — wait: Wait for redirect to home
3. ✅ Verify that the URL is now the home page. — assert_url: Verify home page URL
4. ✅ Verify the user is logged in by checking the top-right corner/header for "System Administrator" or the user avatar/name. — assert_visible: Verify user profile in header
5. ✅ Take a screenshot of the home page after login. — screenshot: Capture final state

## Expected Results

- Clicking the "Admin User" button triggers an automatic login flow
- The browser redirects from /login to the homepage (/)
- The top-right header shows "System Administrator" or the admin user's name
- The homepage content is fully rendered and accessible

## Notes

Ran manually via AI Agent due to LLM provider unavailability. Auto-login flow is working as expected.

## Evidence

### Screenshots

- [final.png](./final.png)

### Videos

- [recording.webp](./recording.webp)
