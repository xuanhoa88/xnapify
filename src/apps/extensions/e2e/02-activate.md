---
email: admin@test.com
password: admin123
role: admin
---

# Activate Extension

Tests the extension activation lifecycle via the toggle switch.

## Activate extension via toggle switch

1. Log in as admin
2. Navigate to the extensions admin page
3. Find an inactive extension card (toggle switch is unchecked)
4. Click the toggle switch on that extension card
5. Confirm the "Activate Extension" modal
6. Observe the action tag changes to "Activating..." with a shimmer animation
7. Wait for the success toast "Extension activated successfully"
8. Verify the toggle switch is now checked (on)

## Verify activated extension persists after page refresh

1. Refresh the page
2. Wait for the extension cards to load
3. Verify the previously activated extension still has its toggle switch checked

## Verify activated extension appears in Active filter tab

1. Navigate to the extensions admin page
2. Click the "Active" filter tab
3. Verify the activated extension card is visible
4. Verify the badge count on the "Active" tab includes this extension
