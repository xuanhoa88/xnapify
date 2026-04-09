# E2E Test Results: quick-access-plugin

**Date:** 2026-04-09_00_22
**Port:** 1337
**Total:** 3/8 passed
**Duration:** 83187ms

## Results

| # | Test Case | Title | Result | Details |
|---|-----------|-------|--------|---------|
| 1 | auth/001-login-api-returns-valid-jwt | Login API Returns Valid JWT | ❌ FAIL | [result](../../auth/001-login-api-returns-valid-jwt/_results/2026-04-09_00_22/result.md) |
| 2 | auth/002-login-api-rejects-invalid | Login API Rejects Invalid Credentials | ❌ FAIL | [result](../../auth/002-login-api-rejects-invalid/_results/2026-04-09_00_22/result.md) |
| 3 | auth/01-login-jwt | Login API Returns Valid JWT | ✅ PASS | [result](../../auth/01-login-jwt/_results/2026-04-09_00_22/result.md) |
| 4 | login/001-quick-access-buttons-visible | Quick Access Buttons Visible on Login Page | ❌ FAIL | [result](../../login/001-quick-access-buttons-visible/_results/2026-04-09_00_22/result.md) |
| 5 | login/002-quick-login-via-demo-account | Quick Login via Demo Account Button | ❌ FAIL | [result](../../login/002-quick-login-via-demo-account/_results/2026-04-09_00_22/result.md) |
| 6 | login/01-buttons-visible | Quick Access Buttons Visible on Login Page | ✅ PASS | [result](../../login/01-buttons-visible/_results/2026-04-09_00_22/result.md) |
| 7 | login/02-demo-login | Quick Login via Demo Account Button | ✅ PASS | [result](../../login/02-demo-login/_results/2026-04-09_00_22/result.md) |
| 8 | user-flow/001-full-login-and-profile-update | Full Login and Profile Update Flow | ❌ FAIL | [result](../../user-flow/001-full-login-and-profile-update/_results/2026-04-09_00_22/result.md) |

## Failed Tests

### auth/001-login-api-returns-valid-jwt: Login API Returns Valid JWT
- **Error:** Compilation failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../auth/001-login-api-returns-valid-jwt/_results/2026-04-09_00_22/result.md)

### auth/002-login-api-rejects-invalid: Login API Rejects Invalid Credentials
- **Error:** Compilation failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../auth/002-login-api-rejects-invalid/_results/2026-04-09_00_22/result.md)

### login/001-quick-access-buttons-visible: Quick Access Buttons Visible on Login Page
- **Error:** Compilation failed: HTTP 429: {"error":{"message":"Rate limit exceeded: limit_rpm/qwen/qwen3-coder-480b-a35b-07-25/a9bbd882-011f-4606-8f60-85f3cb642586. High demand for qwen/qwen3-coder:free on OpenRouter - limited to 8 requests p
- **Result:** [result](../../login/001-quick-access-buttons-visible/_results/2026-04-09_00_22/result.md)

### login/002-quick-login-via-demo-account: Quick Login via Demo Account Button
- **Error:** Compilation failed: HTTP 429: {"error":{"message":"Rate limit exceeded: limit_rpm/qwen/qwen3-coder-480b-a35b-07-25/a9bbd882-011f-4606-8f60-85f3cb642586. High demand for qwen/qwen3-coder:free on OpenRouter - limited to 8 requests p
- **Result:** [result](../../login/002-quick-login-via-demo-account/_results/2026-04-09_00_22/result.md)

### user-flow/001-full-login-and-profile-update: Full Login and Profile Update Flow
- **Error:** Compilation failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../user-flow/001-full-login-and-profile-update/_results/2026-04-09_00_22/result.md)
