# Login API Rejects Invalid Credentials

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/002-login-api-rejects-invalid/test.md
**Type:** 🔌 API
**Date:** 2026-04-08T18:33:18.700Z
**Result:** ❌ FAIL
**Duration:** 1ms

## Steps Executed

1. ❌ Send POST request to /api/auth/login with email and wrong password — providerConfig.authHeader is not a function

## Expected Results

- Login returns HTTP 401 Unauthorized
- Response body contains an error description
- No token is returned

## Notes

Compilation failed: providerConfig.authHeader is not a function

## Evidence

No evidence captured.
