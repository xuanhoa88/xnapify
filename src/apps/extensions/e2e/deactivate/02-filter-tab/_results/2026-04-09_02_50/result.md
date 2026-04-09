# Verify Deactivated Extension Moves to Inactive Filter

**Source:** src/apps/extensions/e2e/deactivate/02-filter-tab/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:55:50.515Z
**Result:** ❌ FAIL
**Duration:** 73943ms

## Steps Executed

1. ❌ Log in as admin — Element not found after retry timeout

## Expected Results

- The "Inactive" filter tab shows the deactivated extension card
- The "Active" filter tab does NOT show the deactivated extension card
- Filter tab badge counts update correctly after deactivation
- Switching between tabs correctly filters the extension grid

## Notes

Element not found after retry timeout

## Evidence

### Screenshots

- [final.png](./final.png)
