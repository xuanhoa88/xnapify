---
email: admin@example.com
password: admin123
role: admin
---

# Verify Uninstalled Extension is Gone After Refresh

Verify that a previously uninstalled extension does not reappear after a page refresh.

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Refresh the page
4. Wait for the extension cards to load
5. Verify the uninstalled extension card is no longer visible

## Expected Results

- The extensions admin page reloads completely after refresh
- The previously uninstalled extension card does NOT appear in the grid
- The total extension count remains decreased
- No error messages are shown related to the removed extension
