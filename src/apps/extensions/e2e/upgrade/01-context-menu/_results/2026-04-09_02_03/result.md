# Upgrade Extension via Context Menu

**Source:** src/apps/extensions/e2e/upgrade/01-context-menu/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:11:20.568Z
**Result:** ❌ FAIL
**Duration:** 3235ms

## Steps Executed

1. ❌ Log in as admin — net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/

## Expected Results

- The "..." button on the extension card opens a context menu
- The context menu contains a "Check for Updates" option
- The action tag shows "Upgrading..." during the upgrade process
- A success toast "Extension upgraded successfully" appears after completion
- The extension card remains visible with updated version information
- The extension continues to function normally after upgrade

## Notes

net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/

## Evidence

No evidence captured.
