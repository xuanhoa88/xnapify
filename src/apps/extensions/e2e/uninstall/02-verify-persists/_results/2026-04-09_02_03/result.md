# Verify Uninstalled Extension is Gone After Refresh

**Source:** src/apps/extensions/e2e/uninstall/02-verify-persists/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:11:17.331Z
**Result:** ❌ FAIL
**Duration:** 3581ms

## Steps Executed

1. ❌ Log in as admin — net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/

## Expected Results

- The extensions admin page reloads completely after refresh
- The previously uninstalled extension card does NOT appear in the grid
- The total extension count remains decreased
- No error messages are shown related to the removed extension

## Notes

net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/

## Evidence

No evidence captured.
