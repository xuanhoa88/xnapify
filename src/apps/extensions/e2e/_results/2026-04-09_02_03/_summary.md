# E2E Test Results: extensions

**Date:** 2026-04-09_02_03
**Port:** 1337
**Total:** 3/10 passed
**Duration:** 469351ms

## Results

| # | Test Case | Title | Result | Details |
|---|-----------|-------|--------|---------|
| 1 | activate/01-toggle | Activate Extension via Toggle Switch | ❌ FAIL | [result](../../activate/01-toggle/_results/2026-04-09_02_03/result.md) |
| 2 | activate/02-verify-persists | Verify Activated Extension Persists After Refresh | ❌ FAIL | [result](../../activate/02-verify-persists/_results/2026-04-09_02_03/result.md) |
| 3 | activate/03-filter-tab | Verify Activated Extension Appears in Active Filter Tab | ❌ FAIL | [result](../../activate/03-filter-tab/_results/2026-04-09_02_03/result.md) |
| 4 | deactivate/01-toggle | Deactivate Extension via Toggle Switch | ❌ FAIL | [result](../../deactivate/01-toggle/_results/2026-04-09_02_03/result.md) |
| 5 | deactivate/02-filter-tab | Verify Deactivated Extension Moves to Inactive Filter | ✅ PASS | [result](../../deactivate/02-filter-tab/_results/2026-04-09_02_03/result.md) |
| 6 | install/01-upload | Upload Extension Package | ❌ FAIL | [result](../../install/01-upload/_results/2026-04-09_02_03/result.md) |
| 7 | install/02-verify-persists | Verify Installed Extension Persists After Refresh | ✅ PASS | [result](../../install/02-verify-persists/_results/2026-04-09_02_03/result.md) |
| 8 | uninstall/01-remove | Uninstall an Inactive Extension | ✅ PASS | [result](../../uninstall/01-remove/_results/2026-04-09_02_03/result.md) |
| 9 | uninstall/02-verify-persists | Verify Uninstalled Extension is Gone After Refresh | ❌ FAIL | [result](../../uninstall/02-verify-persists/_results/2026-04-09_02_03/result.md) |
| 10 | upgrade/01-context-menu | Upgrade Extension via Context Menu | ❌ FAIL | [result](../../upgrade/01-context-menu/_results/2026-04-09_02_03/result.md) |

## Failed Tests

### activate/01-toggle: Activate Extension via Toggle Switch
- **Error:** Login failed — still on login page
- **Result:** [result](../../activate/01-toggle/_results/2026-04-09_02_03/result.md)

### activate/02-verify-persists: Verify Activated Extension Persists After Refresh
- **Error:** Login failed — still on login page
- **Result:** [result](../../activate/02-verify-persists/_results/2026-04-09_02_03/result.md)

### activate/03-filter-tab: Verify Activated Extension Appears in Active Filter Tab
- **Error:** Login failed — still on login page
- **Result:** [result](../../activate/03-filter-tab/_results/2026-04-09_02_03/result.md)

### deactivate/01-toggle: Deactivate Extension via Toggle Switch
- **Error:** Navigation timeout of 30000 ms exceeded
- **Result:** [result](../../deactivate/01-toggle/_results/2026-04-09_02_03/result.md)

### install/01-upload: Upload Extension Package
- **Error:** Waiting failed: 60000ms exceeded
- **Result:** [result](../../install/01-upload/_results/2026-04-09_02_03/result.md)

### uninstall/02-verify-persists: Verify Uninstalled Extension is Gone After Refresh
- **Error:** net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/
- **Result:** [result](../../uninstall/02-verify-persists/_results/2026-04-09_02_03/result.md)

### upgrade/01-context-menu: Upgrade Extension via Context Menu
- **Error:** net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/
- **Result:** [result](../../upgrade/01-context-menu/_results/2026-04-09_02_03/result.md)
