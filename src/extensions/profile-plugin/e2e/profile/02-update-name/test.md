---
email: user@test.com
password: user123
role: user
---

# Update Display Name

Verify that a user can update their display name through the profile page.

## Steps

1. Log in
2. Navigate to the profile page
3. Wait for the input field with selector `input[name='profile.display_name']` to be visible
4. Clear the input field with selector `input[name='profile.display_name']`
5. Type "Updated Display Name" into the input field with selector `input[name='profile.display_name']`
6. Click the button with text "Save" or type "submit"
7. Wait for the success message or toast to appear
8. Refresh the current page
9. Wait for the input field with selector `input[name='profile.display_name']` to be visible after reload
10. Verify the input field with selector `input[name='profile.display_name']` contains "Updated Display Name"

## Expected Results

- The display name input field with name "profile.display_name" is editable
- The field accepts the new display name value "Updated Display Name"
- A success toast or confirmation message appears after saving
- After page refresh, the display name field retains the value "Updated Display Name"
- The updated name is persisted to the database
