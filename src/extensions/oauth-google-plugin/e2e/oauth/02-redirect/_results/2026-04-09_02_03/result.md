# Google OAuth Button Triggers Redirect

**Source:** src/extensions/oauth-google-plugin/e2e/oauth/02-redirect/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:11:27.616Z
**Result:** ❌ FAIL
**Duration:** 2937ms

## Steps Executed

1. ❌ Navigate to the login page — net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/login

## Expected Results

- Clicking the button triggers a navigation or popup to Google's OAuth consent page
- The redirect URL contains "accounts.google.com" or the app's OAuth callback endpoint
- No error page or broken redirect occurs
- The OAuth flow initiates correctly with the app's client ID

## Notes

net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/login

## Evidence

### Screenshots

- [final.png](./final.png)
