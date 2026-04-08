# Login API Returns Valid JWT

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/01-login-jwt/test.md
**Type:** 🔌 API
**Date:** 2026-04-08T03:22:57.357Z
**Result:** ✅ PASS
**Duration:** 131879ms

## Steps Executed

1. ✅ Send POST request to /api/auth/login with email and password from prerequisites — api_request: Login with credentials from prerequisites
2. ✅ Assert response status is 200 — assert_status: Verify response status is 200
3. ✅ Assert response body contains "accessToken" field — assert_body: Verify token field exists in response body
4. ✅ Store the token from response body field "accessToken" as "authToken" — store_value: Store the JWT token for later use
5. ✅ Set Authorization header to "Bearer {{authToken}}" — set_header: Set a persistent request header using a stored value
6. ✅ Send GET request to /api/auth/profile — api_request: Fetch current user profile
7. ✅ Assert response status is 200 — assert_status: Verify response status is 200
8. ✅ Assert response body field "user.email" equals "admin@example.com" — assert_body: Verify user email matches login credential

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential

## Notes

All steps completed successfully.

## Evidence

No evidence captured.
