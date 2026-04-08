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
3. Wait for the extensions toolbar and card grid to load
4. Open the Inactive filter tab to show deactivated extensions
5. Find an inactive extension card with a visible "Remove" button or unchecked toggle
6. Click the toggle switch label inside the first element with class `.inactive-extension-card`
7. Confirm the "Activate Extension" modal
8. Wait for the activation to complete and the success toast to appear

## Expected Results

- The extensions admin page loads successfully for admin users
- The Inactive filter tab displays deactivated extensions
- An inactive extension card is available with a Remove button or unchecked toggle
- Clicking the toggle opens the Activate Extension modal
- The extension becomes active after confirmation
- A success toast appears indicating the extension was activated
- The toggle switch remains checked after activation
