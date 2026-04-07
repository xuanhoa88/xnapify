# Login API Returns Valid JWT

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/01-login-jwt/test.md
**Type:** 🔌 API
**Date:** 2026-04-07T13:50:03.563Z
**Result:** ❌ FAIL
**Duration:** 54200ms

## Steps Executed

1. ✅ Send POST request to /api/auth/login with email and password from prerequisites — api_request: Login with email and password from prerequisites
2. ❌ Assert response status is 200 — Expected status 200, got 422: {"success":false,"timestamp":"2026-04-07T13:49:09.389Z","message":"Validation failed","errors":{"email":["Email is invalid"]},"errorId":"23d71e51-dcd7-4aa4-b0a4-5ee7dcd796fd"}

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential

## Notes

Expected status 200, got 422: {"success":false,"timestamp":"2026-04-07T13:49:09.389Z","message":"Validation failed","errors":{"email":["Email is invalid"]},"errorId":"23d71e51-dcd7-4aa4-b0a4-5ee7dcd796fd"}

## Evidence

No evidence captured.
