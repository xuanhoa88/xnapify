# E2E Test Results: extensions

**Date:** 2026-04-08_18_14
**Port:** 1337
**Total:** 3/10 passed
**Duration:** 748656ms

## Results

| # | Test Case | Title | Result | Details |
|---|-----------|-------|--------|---------|
| 1 | activate/01-toggle | Activate Extension via Toggle Switch | ✅ PASS | [result](../../activate/01-toggle/_results/2026-04-08_18_14/result.md) |
| 2 | activate/02-verify-persists | Verify Activated Extension Persists After Refresh | ✅ PASS | [result](../../activate/02-verify-persists/_results/2026-04-08_18_14/result.md) |
| 3 | activate/03-filter-tab | Verify Activated Extension Appears in Active Filter Tab | ❌ FAIL | [result](../../activate/03-filter-tab/_results/2026-04-08_18_14/result.md) |
| 4 | deactivate/01-toggle | Deactivate Extension via Toggle Switch | ❌ FAIL | [result](../../deactivate/01-toggle/_results/2026-04-08_18_14/result.md) |
| 5 | deactivate/02-filter-tab | Verify Deactivated Extension Moves to Inactive Filter | ❌ FAIL | [result](../../deactivate/02-filter-tab/_results/2026-04-08_18_14/result.md) |
| 6 | install/01-upload | Upload Extension Package | ❌ FAIL | [result](../../install/01-upload/_results/2026-04-08_18_14/result.md) |
| 7 | install/02-verify-persists | Verify Installed Extension Persists After Refresh | ❌ FAIL | [result](../../install/02-verify-persists/_results/2026-04-08_18_14/result.md) |
| 8 | uninstall/01-remove | Uninstall an Inactive Extension | ❌ FAIL | [result](../../uninstall/01-remove/_results/2026-04-08_18_14/result.md) |
| 9 | uninstall/02-verify-persists | Verify Uninstalled Extension is Gone After Refresh | ✅ PASS | [result](../../uninstall/02-verify-persists/_results/2026-04-08_18_14/result.md) |
| 10 | upgrade/01-context-menu | Upgrade Extension via Context Menu | ❌ FAIL | [result](../../upgrade/01-context-menu/_results/2026-04-08_18_14/result.md) |

## Failed Tests

### activate/03-filter-tab: Verify Activated Extension Appears in Active Filter Tab
- **Error:** Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../activate/03-filter-tab/_results/2026-04-08_18_14/result.md)

### deactivate/01-toggle: Deactivate Extension via Toggle Switch
- **Error:** Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../deactivate/01-toggle/_results/2026-04-08_18_14/result.md)

### deactivate/02-filter-tab: Verify Deactivated Extension Moves to Inactive Filter
- **Error:** Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../deactivate/02-filter-tab/_results/2026-04-08_18_14/result.md)

### install/01-upload: Upload Extension Package
- **Error:** Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../install/01-upload/_results/2026-04-08_18_14/result.md)

### install/02-verify-persists: Verify Installed Extension Persists After Refresh
- **Error:** Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../install/02-verify-persists/_results/2026-04-08_18_14/result.md)

### uninstall/01-remove: Uninstall an Inactive Extension
- **Error:** Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../uninstall/01-remove/_results/2026-04-08_18_14/result.md)

### upgrade/01-context-menu: Upgrade Extension via Context Menu
- **Error:** Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../upgrade/01-context-menu/_results/2026-04-08_18_14/result.md)
