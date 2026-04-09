# Google OAuth Button Triggers Redirect

**Source:** src/extensions/oauth-google-plugin/e2e/oauth/02-redirect/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:30:53.031Z
**Result:** ❌ FAIL
**Duration:** 18301ms

## Steps Executed

1. ✅ Navigate to the login page — navigate: Navigate to the login page
2. ❌ Click the "Sign in with Google" button — Retry failed: providerConfig.authHeader is not a function

## Expected Results

- Clicking the button triggers a navigation or popup to Google's OAuth consent page
- The redirect URL contains "accounts.google.com" or the app's OAuth callback endpoint
- No error page or broken redirect occurs
- The OAuth flow initiates correctly with the app's client ID

## Notes

Retry failed: providerConfig.authHeader is not a function

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
