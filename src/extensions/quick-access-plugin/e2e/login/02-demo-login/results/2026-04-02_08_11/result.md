# Quick Login via Demo Account Button

**Source:** src/extensions/quick-access-plugin/e2e/login/02-demo-login/test.md
**Date:** 2026-04-02T08:12:17.481Z
**Result:** ❌ FAIL
**Duration:** 24670ms

## Steps Executed

1. ✅ Navigate to the login pagenavigate: Open the login page
2. ✅ Click the "Admin User" quick access demo account buttonclick: Click the Admin User quick login button
3. ✅ Wait for the form to auto-fill with demo credentialswait: Wait for auto-fill and form submission
4. ✅ Observe the form submits automatically or wait for redirectwait: Wait for redirect after login
5. ❌ Verify the user is logged in and redirected to the dashboard — Element not found after retry timeout

## Expected Results

- Clicking the "Admin User" button triggers an automatic login flow
- The browser redirects from /login to the homepage (/)
- The top-right header shows "System Administrator" or the admin user's name
- The homepage content is fully rendered and accessible

## Notes

Element not found after retry timeout

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [step-03.png](./step-03.png)
- [step-04.png](./step-04.png)
