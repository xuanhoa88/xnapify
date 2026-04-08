---
email: admin@example.com
password: admin123
role: admin
---

# Verify Activated Extension Appears in Active Filter Tab

Verify that an activated extension appears when filtering by "Active" status.

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Click the "Active" filter tab
4. Verify an element with selector `.active-extension-card` is visible in the filtered list
5. Verify the badge count on the "Active" tab includes this extension

## Expected Results

- The "Active" filter tab is clickable and highlights when selected
- The activated extension card is visible in the filtered list
- Only active extensions are shown when the "Active" tab is selected
- The badge count on the "Active" tab reflects the correct number of active extensions
