---
email: admin@example.com
password: admin123
role: admin
---

# Verify Activated Extension Persists After Refresh

Verify that a previously activated extension retains its active state after page refresh.

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Refresh the page
4. Wait for the extension cards to load
5. Verify an element with selector `.active-extension-card input[type="checkbox"]` is checked

## Expected Results

- The extensions admin page reloads completely after refresh
- The previously activated extension remains visible
- The toggle switch on the active extension remains checked
- The extension status indicator shows it is still active
