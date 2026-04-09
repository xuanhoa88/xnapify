# E2E Test Results: posts-module

**Date:** 2026-04-08_18_20
**Port:** 1337
**Total:** 0/2 passed
**Duration:** 71836ms

## Results

| # | Test Case | Title | Result | Details |
|---|-----------|-------|--------|---------|
| 1 | posts/01-page-loads | Posts Admin Page Loads | ❌ FAIL | [result](../../posts/01-page-loads/_results/2026-04-08_18_20/result.md) |
| 2 | posts/02-create-new | Create a New Post | ❌ FAIL | [result](../../posts/02-create-new/_results/2026-04-08_18_20/result.md) |

## Failed Tests

### posts/01-page-loads: Posts Admin Page Loads
- **Error:** Retry failed: HTTP 429: {"error":{"message":"Rate limit exceeded: limit_rpm/qwen/qwen3-coder-480b-a35b-07-25/a9bbd882-011f-4606-8f60-85f3cb642586. High demand for qwen/qwen3-coder:free on OpenRouter - limited to 8 requests p
- **Result:** [result](../../posts/01-page-loads/_results/2026-04-08_18_20/result.md)

### posts/02-create-new: Create a New Post
- **Error:** Retry failed: HTTP 429: {"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"qwen/qwen3-coder:free is temporarily rate-limited upstream. Please retry shortly, or add your own key to accumulate your rat
- **Result:** [result](../../posts/02-create-new/_results/2026-04-08_18_20/result.md)
