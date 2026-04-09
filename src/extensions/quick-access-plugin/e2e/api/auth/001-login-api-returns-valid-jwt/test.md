---
email: admin@example.com
password: admin123
---

# Login API Returns Valid JWT

Verify the authentication endpoint returns a valid JWT token for valid credentials.

## Steps

1. Send POST request to /api/auth/login with email and password from prerequisites
2. Assert response status is 200
3. Assert response body contains "accessToken" field
4. Use the token to send GET request to /api/auth/profile
5. Assert response status is 200
6. Assert response body field "user.email" equals "admin@example.com"

## Expected Results

- Login returns HTTP 200 with a JWT token
- Profile endpoint accepts the token and returns user data
- Email in profile matches the login credential
