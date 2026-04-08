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
4. Verify the "Display Name" label is visible on the profile form
5. Verify the display name input field with name "profile.display_name" is present

## Expected Results

- The profile page loads without errors for an authenticated user
- A profile form is displayed with editable fields
- The "Display Name" label is visible
- An input field with name "profile.display_name" is present and editable
- The form shows the current user's existing profile data
