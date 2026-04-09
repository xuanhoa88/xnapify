# Full Login and Profile Update Flow

**Source:** src/extensions/quick-access-plugin/e2e/system/user-flow/001-full-login-and-profile-update/test.md
**Type:** 🔗 System
**Date:** 2026-04-09T00:24:12.670Z
**Result:** ❌ FAIL
**Duration:** 5333ms

## Steps Executed

1. ❌ Send POST request to /api/auth/login to get JWT token — HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Expected Results

- Login API returns valid token
- Profile page loads with user data
- Name update saves successfully
- API confirms the updated name

## Notes

Compilation failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat

## Evidence

No evidence captured.
