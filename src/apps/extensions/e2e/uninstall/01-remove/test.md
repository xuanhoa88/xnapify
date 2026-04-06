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
3. Find an inactive extension card (must be deactivated first)
4. Click the "Remove" button on that extension card
5. Confirm the "Uninstall Extension" modal
6. Observe the action tag changes to "Uninstalling..."
7. Wait for the success toast "Extension uninstalled successfully"
8. Verify the extension card is no longer visible in the grid

## Expected Results

- An inactive extension card is found with a "Remove" button visible
- A confirmation modal titled "Uninstall Extension" appears after clicking Remove
- The action tag shows "Uninstalling..." during the removal process
- A success toast "Extension uninstalled successfully" appears
- The extension card is removed from the grid
- The total extension count decreases by one
