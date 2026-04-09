# Upgrade Extension via Context Menu

**Source:** src/apps/extensions/e2e/upgrade/01-context-menu/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T04:35:52.734Z
**Result:** ❌ FAIL
**Duration:** 31497ms

## Steps Executed

1. ❌ Log in as admin — Navigation timeout of 30000 ms exceeded

## Expected Results

- The "..." button on the extension card opens a context menu
- The context menu contains a "Check for Updates" option
- The action tag shows "Upgrading..." during the upgrade process
- A success toast "Extension upgraded successfully" appears after completion
- The extension card remains visible with updated version information
- The extension continues to function normally after upgrade

## Notes

Navigation timeout of 30000 ms exceeded

## Evidence

### Screenshots

- [final.png](./final.png)
