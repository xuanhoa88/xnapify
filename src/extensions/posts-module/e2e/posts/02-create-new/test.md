---
email: admin@test.com
password: admin123
role: admin
---

# Create a New Post

Verify that an admin can create a new post through the post editor form.

## Steps

1. Log in as admin
2. Navigate to the posts admin page
3. Click the "Create Post" or "New Post" button
4. Wait for the post editor form to load
5. Fill in the title field with "E2E Test Post"
6. Fill in the content area with some test content
7. Click the "Publish" or "Save" button
8. Wait for the success toast or redirect to the posts list
9. Verify the new post "E2E Test Post" appears in the posts list

## Expected Results

- The post editor form loads with title and content fields
- The title field accepts "E2E Test Post" as input
- The content area accepts text input
- A success toast or confirmation appears after clicking Save/Publish
- The browser redirects to the posts list page after saving
- The new post "E2E Test Post" is visible in the posts list
