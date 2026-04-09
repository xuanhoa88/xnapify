# Full Login and Profile Update Flow

**Source:** src/extensions/quick-access-plugin/e2e/system/user-flow/001-full-login-and-profile-update/test.md
**Type:** 🔗 System
**Date:** 2026-04-09T02:12:47.812Z
**Result:** ❌ FAIL
**Duration:** 16681ms

## Steps Executed

1. ❌ Send POST request to /api/auth/login to get JWT token — connect ECONNREFUSED 127.0.0.1:1337

## Expected Results

- Login API returns valid token
- Profile page loads with user data
- Name update saves successfully
- API confirms the updated name

## Notes

connect ECONNREFUSED 127.0.0.1:1337

## Evidence

### Screenshots

- [final.png](./final.png)
