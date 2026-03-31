---
email: admin@test.com
password: admin123
role: admin
---

# Uninstall Extension

Tests the extension uninstall lifecycle via the Remove button.

## Uninstall an inactive extension

1. Log in as admin
2. Navigate to the extensions admin page
3. Find an inactive extension card (must be deactivated first)
4. Click the "Remove" button on that extension card
5. Confirm the "Uninstall Extension" modal
6. Observe the action tag changes to "Uninstalling..."
7. Wait for the success toast "Extension uninstalled successfully"
8. Verify the extension card is no longer visible in the grid

## Verify uninstalled extension is gone after refresh

1. Refresh the page
2. Wait for the extension cards to load
3. Verify the uninstalled extension card is no longer visible
