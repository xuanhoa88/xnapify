# Full Login and Profile Update Flow

**Source:** src/extensions/quick-access-plugin/e2e/system/user-flow/001-full-login-and-profile-update/test.md
**Type:** 🔗 System
**Date:** 2026-04-09T04:42:13.159Z
**Result:** ❌ FAIL
**Duration:** 21498ms

## Steps Executed

1. ✅ Send POST request to /api/auth/login to get JWT token — api_request: Send POST request to /api/auth/login to get JWT token using credentials from prerequisites
2. ✅ Navigate to the profile page in the browser — navigate: Navigate to the profile page in the browser
3. ❌ Verify the profile page shows the current user name — Text "admin@example.com" not visible on page

## Expected Results

- Login API returns valid token
- Profile page loads with user data
- Name update saves successfully
- API confirms the updated name

## Notes

Text "admin@example.com" not visible on page

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
