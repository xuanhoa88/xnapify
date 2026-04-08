# Verify Activated Extension Persists After Refresh

**Source:** src/apps/extensions/e2e/activate/02-verify-persists/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T04:30:05.637Z
**Result:** ❌ FAIL
**Duration:** 601393ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using {{email}} and {{password}} from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to extensions admin page
3. ✅ Refresh the page — reload: Refresh the current page
4. ✅ Wait for the extension cards to load — wait: Wait unconditionally for page content
5. ❌ Verify the previously activated extension still has its toggle switch checked — Test execution timed out after 600s

## Expected Results

- The extensions admin page reloads completely after refresh
- The previously activated extension card is visible
- The toggle switch on the activated extension remains in the checked (on) position
- The extension status indicator shows it is still active

## Notes

Test execution timed out after 600s

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [step-03.png](./step-03.png)
- [step-04.png](./step-04.png)
