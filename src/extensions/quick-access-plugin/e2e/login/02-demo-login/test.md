# Quick Login via Demo Account Button

Verify that clicking a quick access demo account button auto-fills credentials and logs the user in.

## Steps

1. Navigate to /login
2. Click the "Admin User" quick access demo account button
3. Wait 3000 milliseconds for automatic form submission
4. Assert the text "System Administrator" is visible on the page

## Expected Results

- Clicking the "Admin User" button triggers an automatic login flow
- The browser redirects from /login to the homepage (/)
- The top-right header shows "System Administrator" or the admin user's name
- The homepage content is fully rendered and accessible
