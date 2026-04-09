# Quick Login via Demo Account Button

**Source:** src/extensions/quick-access-plugin/e2e/login/02-demo-login/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:12:31.129Z
**Result:** ❌ FAIL
**Duration:** 3870ms

## Steps Executed

1. ❌ Navigate to /login — net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/login

## Expected Results

- Clicking the "Admin User" button triggers an automatic login flow
- The browser redirects from /login to the homepage (/)
- The top-right header shows "System Administrator" or the admin user's name
- The homepage content is fully rendered and accessible

## Notes

net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/login

## Evidence

### Screenshots

- [final.png](./final.png)
