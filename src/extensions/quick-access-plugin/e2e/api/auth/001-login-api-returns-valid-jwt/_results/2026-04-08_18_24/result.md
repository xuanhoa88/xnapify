# Login API Returns Valid JWT

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/001-login-api-returns-valid-jwt/test.md
**Type:** 🔌 API
**Date:** 2026-04-08T18:33:18.697Z
**Result:** ❌ FAIL
**Duration:** 185ms

## Steps Executed

1. ❌ Send POST request to /api/auth/login with email and password from prerequisites — providerConfig.authHeader is not a function

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential

## Notes

Compilation failed: providerConfig.authHeader is not a function

## Evidence

No evidence captured.
