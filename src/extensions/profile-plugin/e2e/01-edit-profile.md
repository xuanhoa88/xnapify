---
email: user@test.com
password: user123
role: user
---

# Edit Profile

Tests the profile-plugin that provides extended profile editing for authenticated users.

## Profile page is accessible when logged in

1. Log in
2. Navigate to the profile page
3. Wait for the page to fully load
4. Verify the profile form is visible with fields like display name, bio, or avatar

## Update display name

1. Navigate to the profile page
2. Find the display name input field
3. Clear the field and type a new display name
4. Click the "Save" or "Update" button
5. Wait for the success toast or confirmation message
6. Refresh the page
7. Verify the display name field still shows the updated value
