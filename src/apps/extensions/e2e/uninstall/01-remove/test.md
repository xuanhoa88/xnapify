---
email: admin@example.com
password: admin123
role: admin
---

# Uninstall an Inactive Extension

Verify that an admin can uninstall an inactive extension via the Remove button.

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Open the Inactive filter tab to show deactivated extensions
4. Wait until an element with selector `.inactive-extension-card` is visible
5. Click the first "Remove" button shown in the inactive extensions list
6. Confirm the "Uninstall Extension" modal
7. Observe the action tag changes to "Uninstalling..."
8. Wait for the success toast "Extension uninstalled successfully"
9. Verify the extension card is no longer visible in the grid

## Expected Results

- The Inactive filter tab shows at least one deactivated extension
- An inactive extension card is found with a "Remove" button visible
- A confirmation modal titled "Uninstall Extension" appears after clicking Remove
- The action tag shows "Uninstalling..." during the removal process
- A success toast "Extension uninstalled successfully" appears
- The extension card is removed from the grid
- The total extension count decreases by one
