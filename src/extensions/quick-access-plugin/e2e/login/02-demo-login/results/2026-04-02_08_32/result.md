# Quick Login via Demo Account Button

**Source:** src/extensions/quick-access-plugin/e2e/login/02-demo-login/test.md
**Date:** 2026-04-02T08:32:25.719Z
**Result:** ❌ FAIL
**Duration:** 9868ms

## Steps Executed

1. ✅ Navigate to the login page — navigate: Open the login page
2. ❌ Click the "Admin User" quick access demo account button — Retry failed: connect ECONNREFUSED 127.0.0.1:11434

## Expected Results

- Clicking the "Admin User" button triggers an automatic login flow
- The browser redirects from /login to the homepage (/)
- The top-right header shows "System Administrator" or the admin user's name
- The homepage content is fully rendered and accessible

## Notes

Retry failed: connect ECONNREFUSED 127.0.0.1:11434

## Evidence

### Screenshots

- [step-01.png](./step-01.png)
