# Posts Admin Page Loads

**Source:** src/extensions/posts-module/e2e/posts/01-page-loads/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:27:58.479Z
**Result:** ❌ FAIL
**Duration:** 38620ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the posts admin page — navigate: Navigate to the posts admin page
3. ✅ Wait for the page to fully load — wait_for_navigation: Wait for a full page navigation to complete
4. ❌ Verify the posts list or empty state is visible — Retry failed: HTTP 429: {"error":{"message":"Rate limit exceeded: limit_rpm/qwen/qwen3-coder-480b-a35b-07-25/a9bbd882-011f-4606-8f60-85f3cb642586. High demand for qwen/qwen3-coder:free on OpenRouter - limited to 8 requests p

## Expected Results

- The posts admin page loads without errors
- Either a list of existing posts or an empty state message is displayed
- A "Create Post" or "New Post" button is visible and clickable
- The page title or heading indicates the Posts section

## Notes

Retry failed: HTTP 429: {"error":{"message":"Rate limit exceeded: limit_rpm/qwen/qwen3-coder-480b-a35b-07-25/a9bbd882-011f-4606-8f60-85f3cb642586. High demand for qwen/qwen3-coder:free on OpenRouter - limited to 8 requests p

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [step-03.png](./step-03.png)
