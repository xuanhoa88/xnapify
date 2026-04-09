---
email: admin@example.com
password: admin123
---

# Full Login and Profile Update Flow

End-to-end system test: login via API, navigate to profile page, update name.

## Steps

1. Send POST request to /api/auth/login to get JWT token
2. Navigate to the profile page in the browser
3. Verify the profile page shows the current user name
4. Update the display name field to "Test Admin"
5. Click the Save button
6. Send GET request to /api/auth/profile to verify the change
7. Assert response body field "user.display_name" equals "Test Admin"

## Expected Results

- Login API returns valid token
- Profile page loads with user data
- Name update saves successfully
- API confirms the updated name
