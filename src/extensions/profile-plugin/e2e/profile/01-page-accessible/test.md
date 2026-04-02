---
email: user@test.com
password: user123
role: user
---

# Profile Page is Accessible When Logged In

Verify that an authenticated user can access the profile page with editable fields.

## Steps

1. Log in
2. Navigate to the profile page
3. Wait for the page to fully load
4. Verify the profile form is visible with fields like display name, bio, or avatar

## Expected Results

- The profile page loads without errors for an authenticated user
- A profile form is displayed with editable fields
- At minimum, a "display name" or "name" field is visible
- The form shows the current user's existing profile data
