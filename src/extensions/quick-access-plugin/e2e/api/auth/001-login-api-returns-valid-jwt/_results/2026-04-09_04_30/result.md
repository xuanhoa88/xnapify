# Login API Returns Valid JWT

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/001-login-api-returns-valid-jwt/test.md
**Type:** 🔌 API
**Date:** 2026-04-09T04:40:22.394Z
**Result:** ❌ FAIL
**Duration:** 299ms

## Steps Executed

1. ✅ Send POST request to /api/auth/login with email and password from prerequisites — api_request: Send POST request to /api/auth/login with email and password from prerequisites
2. ✅ Assert response status is 200 — assert_status: Verify response status is 200
3. ✅ Assert response body contains "accessToken" field — assert_body: Verify token field exists in response body
4. ✅ Use the token to send GET request to /api/auth/profile — api_request: Use the token to send GET request to /api/auth/profile
5. ❌ Assert response status is 200 — Expected status 200, got 401: {"success":false,"error":"Invalid token format","code":"TOKEN_INVALID"}

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential

## Notes

Expected status 200, got 401: {"success":false,"error":"Invalid token format","code":"TOKEN_INVALID"}

## Evidence

No evidence captured.
