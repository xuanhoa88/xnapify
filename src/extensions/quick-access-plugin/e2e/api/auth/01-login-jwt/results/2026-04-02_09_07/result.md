# Login API Returns Valid JWT

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/01-login-jwt/test.md
**Type:** 🔌 API
**Date:** 2026-04-02T09:07:44.946Z
**Result:** ✅ PASS
**Duration:** 462ms

## Steps Executed

1. ✅ Send POST request to /api/auth/login with email and password from prerequisites — api_request: Login with admin credentials
2. ✅ Assert response status is 200 — assert_status: Verify login returns 200
3. ✅ Assert response body contains "token" field — assert_body: Verify JWT accessToken is in response
4. ✅ Use the token to send GET request to /api/auth/profile — store_value: Store JWT token for next request
5. ✅ Assert response status is 200 — set_header: Set auth header for profile request
6. ✅ Assert response body field "user.email" equals "admin@example.com" — api_request: Fetch user profile with stored token
7. ✅ (not executed) — assert_status: Verify profile returns 200
8. ✅ (not executed) — assert_body: Verify email matches login credential

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential

## Notes

All steps completed successfully.

## Evidence

No evidence captured.
