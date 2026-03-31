# OAuth Google Login

Tests the oauth-google-plugin that provides Google OAuth login on the login page.

## Google OAuth button is visible on login page

1. Navigate to the login page
2. Wait for the page to fully load
3. Verify a "Sign in with Google" button is visible in the OAuth section
4. Verify the button is clickable and not disabled

## Google OAuth button triggers redirect

1. Navigate to the login page
2. Click the "Sign in with Google" button
3. Verify the browser navigates to a Google OAuth consent URL or shows an OAuth popup
4. Verify the URL contains "accounts.google.com" or the configured OAuth callback
