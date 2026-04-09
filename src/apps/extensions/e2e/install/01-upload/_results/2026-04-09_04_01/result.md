# Upload Extension Package

**Source:** src/apps/extensions/e2e/install/01-upload/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T04:03:14.672Z
**Result:** ❌ FAIL
**Duration:** 82417ms

## Steps Executed

1. ✅ Log in as admin — login: Log in using admin@example.com and admin123 from prerequisites
2. ✅ Navigate to the extensions admin page — navigate: Navigate to the extensions admin page
3. ✅ Upload the `.zip` extension file directly to the hidden file input (do not click the upload button to prevent OS dialog blocks) — upload_file: Upload the .zip extension file directly to the hidden file input
4. ✅ Confirm the install modal — confirm_modal: Click the confirm/primary button in the visible modal dialog
5. ❌ Wait for the success toast "Extension installed successfully" — Waiting failed: 60000ms exceeded

## Expected Results

- The extensions admin page loads with an "Upload Extension" button
- A file picker dialog appears when clicking upload
- After selecting the zip file, a confirmation modal is displayed
- A success toast "Extension installed successfully" appears after installation
- The new extension card is visible in the extensions grid with its name and version

## Notes

Waiting failed: 60000ms exceeded

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [step-03.png](./step-03.png)
- [step-04.png](./step-04.png)
