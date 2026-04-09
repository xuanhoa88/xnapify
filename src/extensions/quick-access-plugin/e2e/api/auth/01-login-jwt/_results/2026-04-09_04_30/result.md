# Login API Returns Valid JWT

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/01-login-jwt/test.md
**Type:** 🔌 API
**Date:** 2026-04-09T04:40:23.061Z
**Result:** ✅ PASS
**Duration:** 417ms

## Steps Executed

1. ✅ Send POST request to /api/auth/login with email and password from prerequisites — api_request: Send POST request to /api/auth/login with email and password from prerequisites
2. ✅ Assert response status is 200 — assert_status: Verify response status is 200
3. ✅ Assert response body contains "accessToken" field — assert_body: Verify token field exists in response body
4. ✅ Store the token from response body field "accessToken" as "authToken" — store_value: Store the JWT token for later use from the response body field 'accessToken'.
5. ✅ Set Authorization header to "Bearer {{authToken}}" — set_header: Set the Authorization header to include the Bearer token for authentication
6. ✅ Send GET request to /api/auth/profile — api_request: Fetch the user profile using the JWT token from the login response
7. ✅ Assert response status is 200 — assert_status: Verify response status is 200
8. ✅ Assert response body field "user.email" equals "admin@example.com" — assert_body: Verify user email in response body matches the login credential

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential

## Notes

All steps completed successfully.

## Evidence

No evidence captured.
