# Update Display Name

**Source:** src/extensions/profile-plugin/e2e/profile/02-update-name/test.md
**Type:** 🌐 UI
**Date:** 2026-04-08T18:29:23.975Z
**Result:** ✅ PASS
**Duration:** 29403ms

## Steps Executed

1. ✅ Log in — login: Log in using user@test.com and user123 from prerequisites
2. ✅ Navigate to the profile page — navigate: Navigate to the profile page
3. ✅ Wait for the input field with selector `input[name='profile.display_name']` to be visible — wait_for_selector: Wait for the input field with name 'profile.display_name' to be visible
4. ✅ Clear the input field with selector `input[name='profile.display_name']` — clear: Clear the input field for the display name
5. ✅ Type "Updated Display Name" into the input field with selector `input[name='profile.display_name']` — fill: Fill the display name input field with the new value 'Updated Display Name'
6. ✅ Click the button with text "Save" or type "submit" — click: Click the button with text 'Save' to submit the form
7. ✅ Wait for the success message or toast to appear — wait_for_text: Wait for a success toast or confirmation message to appear
8. ✅ Refresh the current page — reload: Refresh the current page
9. ✅ Wait for the input field with selector `input[name='profile.display_name']` to be visible after reload — wait_for_selector: Wait for the input field with name 'profile.display_name' to be visible after reload
10. ✅ Verify the input field with selector `input[name='profile.display_name']` contains "Updated Display Name" — assert_attribute: Verify the input field with selector 'input[name="profile.display_name"]' contains 'Updated Display Name'

## Expected Results

- The display name input field with name "profile.display_name" is editable
- The field accepts the new display name value "Updated Display Name"
- A success toast or confirmation message appears after saving
- After page refresh, the display name field retains the value "Updated Display Name"
- The updated name is persisted to the database

## Notes

All steps completed successfully.

## Evidence

### Screenshots

- [final.png](./final.png)
- [step-01.png](./step-01.png)
- [step-02.png](./step-02.png)
- [step-03.png](./step-03.png)
- [step-04.png](./step-04.png)
- [step-05.png](./step-05.png)
- [step-06.png](./step-06.png)
- [step-07.png](./step-07.png)
- [step-08.png](./step-08.png)
- [step-09.png](./step-09.png)
- [step-10.png](./step-10.png)
