# Login API Returns Valid JWT

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/01-login-jwt/test.md
**Type:** 🔌 API
**Date:** 2026-04-02T09:06:23.094Z
**Result:** ❌ FAIL
**Duration:** 230ms

## Steps Executed

1. ✅ Send POST request to /api/auth/login with email and password from prerequisites — api_request: Login with admin credentials
2. ✅ Assert response status is 200 — assert_status: Verify login returns 200
3. ❌ Assert response body contains "token" field — Retry failed: Cannot read properties of null (reading 'url')

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential

## Notes

Retry failed: Cannot read properties of null (reading 'url')

## Evidence

No evidence captured.
