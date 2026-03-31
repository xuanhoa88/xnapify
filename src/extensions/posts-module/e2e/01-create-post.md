---
email: admin@test.com
password: admin123
role: admin
---

# Create Post

Tests the posts-module extension that provides WordPress-style post management.

## Posts admin page loads

1. Log in as admin
2. Navigate to the posts admin page
3. Wait for the page to fully load
4. Verify the posts list or empty state is visible
5. Verify the "Create Post" or "New Post" button is visible

## Create a new post

1. Navigate to the posts admin page
2. Click the "Create Post" or "New Post" button
3. Wait for the post editor form to load
4. Fill in the title field with "E2E Test Post"
5. Fill in the content area with some test content
6. Click the "Publish" or "Save" button
7. Wait for the success toast or redirect to the posts list
8. Verify the new post "E2E Test Post" appears in the posts list
