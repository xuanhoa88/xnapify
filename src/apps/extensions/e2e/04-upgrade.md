---
email: admin@test.com
password: admin123
role: admin
---

# Upgrade Extension

Tests the extension upgrade lifecycle via the context menu.

## Upgrade extension via context menu

1. Log in as admin
2. Navigate to the extensions admin page
3. Find an installed extension card
4. Click the "..." (more actions) button on that card to open the context menu
5. Click "Check for Updates" in the context menu
6. Observe the action tag changes to "Upgrading..."
7. Wait for the success toast "Extension upgraded successfully"
8. Verify the extension card is still visible and functional
