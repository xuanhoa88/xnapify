# Quick Access Buttons Visible on Login Page

Verify that the quick-access-plugin extension correctly renders demo account login buttons in the login page extension slot.

## Steps

1. Navigate to the login page
2. Wait for the page to fully load
3. Verify the quick access login buttons are visible below the login form
4. Verify there are demo account buttons rendered by the extension slot

## Expected Results

- The login page loads with Email and Password fields and a "Log in" button
- A "Quick Access" section is visible below the login form
- Three demo account buttons are displayed: "Admin User", "John Doe", "Jane Smith"
- Each button shows the user's role label (ADMINISTRATOR, EDITOR, VIEWER)
- Each button shows a hotkey number (1, 2, 3)
