---
email: admin@example.com
password: wrongpassword
---

# Login API Rejects Invalid Credentials

Verify the authentication endpoint rejects requests with wrong password.

## Steps

1. Send POST request to /api/auth/login with email and wrong password
2. Assert response status is 401
3. Assert response body contains error message

## Expected Results

- Login returns HTTP 401 Unauthorized
- Response body contains an error description
- No token is returned
