# Login API Returns Valid JWT

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/01-login-jwt/test.md
**Type:** 🔌 API
**Date:** 2026-04-09T02:11:59.035Z
**Result:** ❌ FAIL
**Duration:** 1654ms

## Steps Executed

1. ❌ Send POST request to /api/auth/login with email and password from prerequisites — connect ECONNREFUSED 127.0.0.1:1337

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential

## Notes

connect ECONNREFUSED 127.0.0.1:1337

## Evidence

No evidence captured.
