# Update Display Name

**Source:** src/extensions/profile-plugin/e2e/profile/02-update-name/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T02:11:39.000Z
**Result:** ❌ FAIL
**Duration:** 3129ms

## Steps Executed

1. ❌ Log in — net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/

## Expected Results

- The display name input field with name "profile.display_name" is editable
- The field accepts the new display name value "Updated Display Name"
- A success toast or confirmation message appears after saving
- After page refresh, the display name field retains the value "Updated Display Name"
- The updated name is persisted to the database

## Notes

net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1337/

## Evidence

### Screenshots

- [final.png](./final.png)
