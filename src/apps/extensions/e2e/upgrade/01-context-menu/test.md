---
email: admin@example.com
password: admin123
role: admin
---

# Upgrade Extension via Context Menu

Verify that an admin can check for updates and upgrade an installed extension via the context menu.

## Steps

1. Log in as admin
2. Navigate to the extensions admin page
3. Find an installed extension card
4. Click the "..." (more actions) button on that card to open the context menu
5. Click "Check for Updates" in the context menu
6. Observe the action tag changes to "Upgrading..."
7. Wait for the success toast "Extension upgraded successfully"
8. Verify the extension card is still visible and functional

## Expected Results

- The "..." button on the extension card opens a context menu
- The context menu contains a "Check for Updates" option
- The action tag shows "Upgrading..." during the upgrade process
- A success toast "Extension upgraded successfully" appears after completion
- The extension card remains visible with updated version information
- The extension continues to function normally after upgrade
