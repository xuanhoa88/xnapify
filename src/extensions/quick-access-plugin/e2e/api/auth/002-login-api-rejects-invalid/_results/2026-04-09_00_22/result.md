# Login API Rejects Invalid Credentials

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/002-login-api-rejects-invalid/test.md
**Type:** 🔌 API
**Date:** 2026-04-09T00:23:14.630Z
**Result:** ❌ FAIL
**Duration:** 5832ms

## Steps Executed

1. ❌ Send POST request to /api/auth/login with email and wrong password — HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Expected Results

- Login returns HTTP 401 Unauthorized
- Response body contains an error description
- No token is returned

## Notes

Compilation failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Evidence

No evidence captured.
