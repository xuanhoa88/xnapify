# Profile Page is Accessible When Logged In

**Source:** src/extensions/profile-plugin/e2e/profile/01-page-accessible/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:11:35.869Z
**Result:** ❌ FAIL
**Duration:** 2964ms

## Steps Executed

1. ❌ Log in — net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/

## Expected Results

- The profile page loads without errors for an authenticated user
- A profile form is displayed with editable fields
- The "Display Name" label is visible
- An input field with name "profile.display_name" is present and editable
- The form shows the current user's existing profile data

## Notes

net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/

## Evidence

### Screenshots

- [final.png](./final.png)
