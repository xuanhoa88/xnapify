# Google OAuth Button Triggers Redirect

**Source:** src/extensions/oauth-google-plugin/e2e/oauth/02-redirect/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:27:19.856Z
**Result:** ❌ FAIL
**Duration:** 23824ms

## Steps Executed

1. ✅ Navigate to the login page — navigate: Navigate to the login page
2. ❌ Click the "Sign in with Google" button — Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Expected Results

- Clicking the button triggers a navigation or popup to Google's OAuth consent page
- The redirect URL contains "accounts.google.com" or the app's OAuth callback endpoint
- No error page or broken redirect occurs
- The OAuth flow initiates correctly with the app's client ID

## Notes

Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
