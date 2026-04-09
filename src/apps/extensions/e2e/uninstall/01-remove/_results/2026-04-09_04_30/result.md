# Uninstall an Inactive Extension

**Source:** src/apps/extensions/e2e/uninstall/01-remove/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T04:34:49.573Z
**Result:** ❌ FAIL
**Duration:** 31714ms

## Steps Executed

1. ❌ Log in as admin — Navigation timeout of 30000 ms exceeded

## Expected Results

- The Inactive filter tab shows at least one deactivated extension
- An inactive extension card is found with a "Remove" button visible
- A confirmation modal titled "Uninstall Extension" appears after clicking Remove
- The action tag shows "Uninstalling..." during the removal process
- A success toast "Extension uninstalled successfully" appears
- The extension card is removed from the grid
- The total extension count decreases by one

## Notes

Navigation timeout of 30000 ms exceeded

## Evidence

### Screenshots

- [final.png](./final.png)
