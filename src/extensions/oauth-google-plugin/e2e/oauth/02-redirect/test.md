# Google OAuth Button Triggers Redirect

Verify that clicking the "Sign in with Google" button initiates an OAuth redirect to Google's consent page.

## Steps

1. Navigate to the login page
2. Click the "Sign in with Google" button
3. Verify the browser navigates to a Google OAuth consent URL or shows an OAuth popup
4. Verify the URL contains "accounts.google.com" or the configured OAuth callback

## Expected Results

- Clicking the button triggers a navigation or popup to Google's OAuth consent page
- The redirect URL contains "accounts.google.com" or the app's OAuth callback endpoint
- No error page or broken redirect occurs
- The OAuth flow initiates correctly with the app's client ID
