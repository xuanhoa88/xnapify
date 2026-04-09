# Upgrade Extension via Context Menu

**Source:** src/apps/extensions/e2e/upgrade/01-context-menu/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:30:19.589Z
**Result:** ❌ FAIL
**Duration:** 28356ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ❌ Find an installed extension card — Retry failed: providerConfig.authHeader is not a function

## Expected Results

- The "..." button on the extension card opens a context menu
- The context menu contains a "Check for Updates" option
- The action tag shows "Upgrading..." during the upgrade process
- A success toast "Extension upgraded successfully" appears after completion
- The extension card remains visible with updated version information
- The extension continues to function normally after upgrade

## Notes

Retry failed: providerConfig.authHeader is not a function

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
