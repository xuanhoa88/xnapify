# Login API Rejects Invalid Credentials

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/002-login-api-rejects-invalid/test.md
**Type:** 🔌 API
**Date:** 2026-04-09T04:40:22.642Z
**Result:** ❌ FAIL
**Duration:** 246ms

## Steps Executed

1. ✅ Send POST request to /api/auth/login with email and wrong password — api_request: Send POST request to /api/auth/login with email and wrong password
2. ✅ Assert response status is 401 — assert_status: Verify response status is 401 Unauthorized
3. ❌ Assert response body contains error message — Expected "error" to exist in response

## Expected Results

- Login returns HTTP 401 Unauthorized
- Response body contains an error description
- No token is returned

## Notes

Expected "error" to exist in response

## Evidence

No evidence captured.
