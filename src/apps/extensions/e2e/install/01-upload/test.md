---
email: admin@test.com
password: admin123
role: admin
---

# Upload Extension Package

Verify that an admin can upload and install a new extension via the upload flow.

### Prerequisite

- fixture_zip: ./test-fixtures/sample-extension.zip

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Click the "Upload Extension" button
4. Select a `.zip` extension file for upload
5. Confirm the install modal
6. Wait for the success toast "Extension installed successfully"
7. Verify the new extension card is visible in the grid

## Expected Results

- The extensions admin page loads with an "Upload Extension" button
- A file picker dialog appears when clicking upload
- After selecting the zip file, a confirmation modal is displayed
- A success toast "Extension installed successfully" appears after installation
- The new extension card is visible in the extensions grid with its name and version
