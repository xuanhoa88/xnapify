# Posts Admin Page Loads

**Source:** src/extensions/posts-module/e2e/posts/01-page-loads/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:31:27.401Z
**Result:** ❌ FAIL
**Duration:** 34367ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the posts admin page — navigate: Navigate to the posts admin page
3. ✅ Wait for the page to fully load — wait_for_navigation: Wait for a full page navigation to complete
4. ❌ Verify the posts list or empty state is visible — Retry failed: providerConfig.authHeader is not a function

## Expected Results

- The posts admin page loads without errors
- Either a list of existing posts or an empty state message is displayed
- A "Create Post" or "New Post" button is visible and clickable
- The page title or heading indicates the Posts section

## Notes

Retry failed: providerConfig.authHeader is not a function

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [step-03.png](./step-03.png)
