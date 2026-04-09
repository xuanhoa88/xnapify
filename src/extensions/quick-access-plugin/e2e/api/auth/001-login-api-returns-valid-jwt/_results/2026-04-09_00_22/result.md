# Login API Returns Valid JWT

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/001-login-api-returns-valid-jwt/test.md
**Type:** 🔌 API
**Date:** 2026-04-09T00:23:08.794Z
**Result:** ❌ FAIL
**Duration:** 19335ms

## Steps Executed

1. ❌ Send POST request to /api/auth/login with email and password from prerequisites — HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential

## Notes

Compilation failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Evidence

No evidence captured.
