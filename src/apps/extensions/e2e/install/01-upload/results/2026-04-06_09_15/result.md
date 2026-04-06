# Upload Extension Package

**Source:** src/apps/extensions/e2e/install/01-upload/test.md
**Type:** 🌐 UI
**Date:** 2026-04-06T09:17:02.844Z
**Result:** ❌ FAIL
**Duration:** 62482ms

## Steps Executed

1. ✅ Log in as admin — login: Log in as admin
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ❌ Click the "Upload Extension" button — Element not found after retry timeout

## Expected Results

- The extensions admin page loads with an "Upload Extension" button
- A file picker dialog appears when clicking upload
- After selecting the zip file, a confirmation modal is displayed
- A success toast "Extension installed successfully" appears after installation
- The new extension card is visible in the extensions grid with its name and version

## Notes

Element not found after retry timeout

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
