---
email: admin@example.com
password: admin123
role: admin
---

# Upload Extension Package

Verify that an admin can upload and install a new extension via the upload flow.

### Prerequisite

- fixture_zip: ./src/__tests__/fixtures/sample-extension.zip

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Upload the `.zip` extension file directly to the hidden file input (do not click the upload button to prevent OS dialog blocks)
4. Confirm the install modal
5. Wait for the success toast "Extension installed successfully"
6. Verify the new extension card is visible in the grid

## Expected Results

- The extensions admin page loads with an "Upload Extension" button
- A file picker dialog appears when clicking upload
- After selecting the zip file, a confirmation modal is displayed
- A success toast "Extension installed successfully" appears after installation
- The new extension card is visible in the extensions grid with its name and version
