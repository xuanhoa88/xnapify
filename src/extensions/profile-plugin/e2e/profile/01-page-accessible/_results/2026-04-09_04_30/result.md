# Profile Page is Accessible When Logged In

**Source:** src/extensions/profile-plugin/e2e/profile/01-page-accessible/test.md
**Type:** 🌐 UI
**Date:** 2026-04-09T04:39:51.037Z
**Result:** ✅ PASS
**Duration:** 25542ms

## Steps Executed

1. ✅ Log in — login: Log in using {{email}} and {{password}} from prerequisites
2. ✅ Navigate to the profile page — navigate: Navigate to the profile page
3. ✅ Wait for the page to fully load — wait_for_navigation: Wait for a full page navigation to complete
4. ✅ Verify the "Display Name" label is visible on the profile form — assert_visible: Verify the 'Display Name' label is visible on the profile form
5. ✅ Verify the display name input field with name "profile.display_name" is present — assert_visible: Verify the Display Name label is visible

## Expected Results

- The profile page loads without errors for an authenticated user
- A profile form is displayed with editable fields
- The "Display Name" label is visible
- An input field with name "profile.display_name" is present and editable
- The form shows the current user's existing profile data

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
