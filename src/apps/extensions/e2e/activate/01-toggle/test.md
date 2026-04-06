---
email: admin@example.com
password: admin123
role: admin
---

# Activate Extension via Toggle Switch

Verify that an admin can activate an inactive extension using the toggle switch.

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Find an inactive extension card (toggle switch is unchecked)
4. Click the toggle switch on that extension card
5. Confirm the "Activate Extension" modal
6. Observe the action tag changes to "Activating..." with a shimmer animation
7. Wait for the success toast "Extension activated successfully"
8. Verify the toggle switch is now checked (on)

## Expected Results

- An inactive extension card is found with its toggle switch in the off position
- A confirmation modal titled "Activate Extension" appears after clicking the toggle
- The action tag shows "Activating..." with a shimmer animation during activation
- A success toast "Extension activated successfully" appears
- The toggle switch transitions to the checked (on) position
- The extension card indicates the extension is now active
