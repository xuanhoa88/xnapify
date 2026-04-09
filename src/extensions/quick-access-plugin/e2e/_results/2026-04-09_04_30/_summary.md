# E2E Test Results: quick-access-plugin

**Date:** 2026-04-09_04_30
**Port:** 1337
**Total:** 1/8 passed
**Duration:** 111050ms

## Results

| # | Test Case | Title | Result | Details |
|---|-----------|-------|--------|---------|
| 1 | auth/001-login-api-returns-valid-jwt | Login API Returns Valid JWT | ❌ FAIL | [result](../../auth/001-login-api-returns-valid-jwt/_results/2026-04-09_04_30/result.md) |
| 2 | auth/002-login-api-rejects-invalid | Login API Rejects Invalid Credentials | ❌ FAIL | [result](../../auth/002-login-api-rejects-invalid/_results/2026-04-09_04_30/result.md) |
| 3 | auth/01-login-jwt | Login API Returns Valid JWT | ✅ PASS | [result](../../auth/01-login-jwt/_results/2026-04-09_04_30/result.md) |
| 4 | login/001-quick-access-buttons-visible | Quick Access Buttons Visible on Login Page | ❌ FAIL | [result](../../login/001-quick-access-buttons-visible/_results/2026-04-09_04_30/result.md) |
| 5 | login/002-quick-login-via-demo-account | Quick Login via Demo Account Button | ❌ FAIL | [result](../../login/002-quick-login-via-demo-account/_results/2026-04-09_04_30/result.md) |
| 6 | login/01-buttons-visible | Quick Access Buttons Visible on Login Page | ❌ FAIL | [result](../../login/01-buttons-visible/_results/2026-04-09_04_30/result.md) |
| 7 | login/02-demo-login | Quick Login via Demo Account Button | ❌ FAIL | [result](../../login/02-demo-login/_results/2026-04-09_04_30/result.md) |
| 8 | user-flow/001-full-login-and-profile-update | Full Login and Profile Update Flow | ❌ FAIL | [result](../../user-flow/001-full-login-and-profile-update/_results/2026-04-09_04_30/result.md) |

## Failed Tests

### auth/001-login-api-returns-valid-jwt: Login API Returns Valid JWT
- **Error:** Expected status 200, got 401: {"success":false,"error":"Invalid token format","code":"TOKEN_INVALID"}
- **Result:** [result](../../auth/001-login-api-returns-valid-jwt/_results/2026-04-09_04_30/result.md)

### auth/002-login-api-rejects-invalid: Login API Rejects Invalid Credentials
- **Error:** Expected "error" to exist in response
- **Result:** [result](../../auth/002-login-api-rejects-invalid/_results/2026-04-09_04_30/result.md)

### login/001-quick-access-buttons-visible: Quick Access Buttons Visible on Login Page
- **Error:** Text "Quick Access" not visible on page
- **Result:** [result](../../login/001-quick-access-buttons-visible/_results/2026-04-09_04_30/result.md)

### login/002-quick-login-via-demo-account: Quick Login via Demo Account Button
- **Error:** Element not found after retry timeout
- **Result:** [result](../../login/002-quick-login-via-demo-account/_results/2026-04-09_04_30/result.md)

### login/01-buttons-visible: Quick Access Buttons Visible on Login Page
- **Error:** Text "Quick Access" not visible on page
- **Result:** [result](../../login/01-buttons-visible/_results/2026-04-09_04_30/result.md)

### login/02-demo-login: Quick Login via Demo Account Button
- **Error:** Element not found after retry timeout
- **Result:** [result](../../login/02-demo-login/_results/2026-04-09_04_30/result.md)

### user-flow/001-full-login-and-profile-update: Full Login and Profile Update Flow
- **Error:** Text "admin@example.com" not visible on page
- **Result:** [result](../../user-flow/001-full-login-and-profile-update/_results/2026-04-09_04_30/result.md)
