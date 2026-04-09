# Login API Rejects Invalid Credentials

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/002-login-api-rejects-invalid/test.md
**Type:** 🔌 API
**Date:** 2026-04-09T02:11:57.379Z
**Result:** ❌ FAIL
**Duration:** 6249ms

## Steps Executed

1. ❌ Send POST request to /api/auth/login with email and wrong password — connect ECONNREFUSED 127.0.0.1:1337

## Expected Results

- Login returns HTTP 401 Unauthorized
- Response body contains an error description
- No token is returned

## Notes

connect ECONNREFUSED 127.0.0.1:1337

## Evidence

No evidence captured.
