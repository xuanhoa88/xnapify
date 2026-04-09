# Create a New Post

**Source:** src/extensions/posts-module/e2e/posts/02-create-new/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:32:24.567Z
**Result:** ❌ FAIL
**Duration:** 57164ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the posts admin page — navigate: Navigate to the posts admin page
3. ❌ Click the "Create Post" or "New Post" button — Retry failed: providerConfig.authHeader is not a function

## Expected Results

- The post editor form loads with title and content fields
- The title field accepts "E2E Test Post" as input
- The content area accepts text input
- A success toast or confirmation appears after clicking Save/Publish
- The browser redirects to the posts list page after saving
- The new post "E2E Test Post" is visible in the posts list

## Notes

Retry failed: providerConfig.authHeader is not a function

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
