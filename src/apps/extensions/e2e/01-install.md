---
email: admin@test.com
password: admin123
role: admin
---

# Install Extension

Tests the extension installation lifecycle through the upload flow.

## Upload a valid extension package

### Prerequisite

- fixture_zip: ./test-fixtures/sample-extension.zip

1. Log in as admin
2. Navigate to the extensions admin page
3. Click the "Upload Extension" button
4. Select a `.zip` extension file for upload
5. Confirm the install modal
6. Wait for the success toast "Extension installed successfully"
7. Verify the new extension card is visible in the grid

## Verify installed extension appears after page refresh

1. Refresh the page
2. Wait for the extension cards to load
3. Verify the previously installed extension card is still visible
