# Quick Access Login

Tests the quick-access-plugin that provides demo account login buttons on the login page.

## Quick login buttons are visible on login page

1. Navigate to the login page
2. Wait for the page to fully load
3. Verify the quick access login buttons are visible below the login form
4. Verify there are demo account buttons (e.g., "Admin", "User") rendered by the extension slot

## Quick login via demo account button

1. Navigate to the login page
2. Click one of the quick access demo account buttons
3. Wait for the form to auto-fill with demo credentials
4. Observe the form submits automatically or wait for redirect
5. Verify the user is logged in and redirected to the dashboard
