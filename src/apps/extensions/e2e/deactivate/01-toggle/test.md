---
email: admin@example.com
password: admin123
role: admin
---

# Deactivate Extension via Toggle Switch

Verify that an admin can deactivate an active extension using the toggle switch.

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Find an active extension card with selector `.active-extension-card`
4. Click the toggle switch label inside that active extension card
5. Confirm the "Deactivate Extension" modal
6. Observe the action tag changes to "Deactivating..." with a shimmer animation
7. Wait for the success toast "Extension deactivated successfully"
8. Verify the checkbox inside the active extension card is now unchecked

## Expected Results

- An active extension card is found with its toggle switch in the on position
- A confirmation modal titled "Deactivate Extension" appears after clicking the toggle
- The action tag shows "Deactivating..." with a shimmer animation during deactivation
- A success toast "Extension deactivated successfully" appears
- The toggle switch transitions to the unchecked (off) position
- The extension card indicates the extension is now inactive
