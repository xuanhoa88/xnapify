# Verify Activated Extension Persists After Refresh

**Source:** src/apps/extensions/e2e/activate/02-verify-persists/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T04:31:52.361Z
**Result:** ❌ FAIL
**Duration:** 39797ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Refresh the page — reload: Refresh the current page
4. ❌ Wait for the extension cards to load — Waiting for selector `.extension-card` failed: Waiting failed: 15000ms exceeded

## Expected Results

- The extensions admin page reloads completely after refresh
- The previously activated extension remains visible
- The toggle switch on the active extension remains checked
- The extension status indicator shows it is still active

## Notes

Waiting for selector `.extension-card` failed: Waiting failed: 15000ms exceeded

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [step-03.png](./step-03.png)
