# Login API Returns Valid JWT

**Source:** src/extensions/quick-access-plugin/e2e/api/auth/01-login-jwt/test.md
**Type:** 🔌 API
**Date:** 2026-04-07T13:26:41.789Z
**Result:** ❌ FAIL
**Duration:** 306827ms

## Steps Executed

1. ✅ Send POST request to /api/auth/login with email and password from prerequisites — api_request: Login with email and password from prerequisites
2. ❌ Assert response status is 200 — Expected status 200, got 422: {"success":false,"timestamp":"2026-04-07T13:25:59.262Z","message":"Validation failed","errors":{"email":["Email is invalid"]},"errorId":"0cf1bcc4-445b-471c-aa9c-cc1da67b5b0e"}

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential

## Notes

Expected status 200, got 422: {"success":false,"timestamp":"2026-04-07T13:25:59.262Z","message":"Validation failed","errors":{"email":["Email is invalid"]},"errorId":"0cf1bcc4-445b-471c-aa9c-cc1da67b5b0e"}

## Evidence

No evidence captured.
