---
email: admin@example.com
password: admin123
role: admin
---

# Verify Deactivated Extension Moves to Inactive Filter

Verify that a deactivated extension appears in the "Inactive" tab and disappears from the "Active" tab.

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Click the "Inactive" filter tab
4. Verify the deactivated extension card is visible
5. Click the "Active" filter tab
6. Verify the deactivated extension card is NOT visible in the Active tab

## Expected Results

- The "Inactive" filter tab shows the deactivated extension card
- The "Active" filter tab does NOT show the deactivated extension card
- Filter tab badge counts update correctly after deactivation
- Switching between tabs correctly filters the extension grid
