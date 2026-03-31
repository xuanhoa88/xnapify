---
email: admin@test.com
password: admin123
role: admin
---

# Deactivate Extension

Tests the extension deactivation lifecycle via the toggle switch.

## Deactivate extension via toggle switch

1. Log in as admin
2. Navigate to the extensions admin page
3. Find an active extension card (toggle switch is checked)
4. Click the toggle switch on that extension card
5. Confirm the "Deactivate Extension" modal
6. Observe the action tag changes to "Deactivating..." with a shimmer animation
7. Wait for the success toast "Extension deactivated successfully"
8. Verify the toggle switch is now unchecked (off)

## Verify deactivated extension moves to Inactive filter

1. Navigate to the extensions admin page
2. Click the "Inactive" filter tab
3. Verify the deactivated extension card is visible
4. Click the "Active" filter tab
5. Verify the deactivated extension card is NOT visible in the Active tab
