/**
 * Seed: Demo posts data
 *
 * Creates sample posts for development and testing.
 */

/**
 * Run the seed
 */
export async function up(_, { container }) {
  const { Post } = container.resolve('models');

  const now = new Date();

  const posts = [
    {
      title: 'Getting Started with xnapify',
      slug: 'getting-started-with-xnapify',
      content:
        'Welcome to xnapify! This guide will walk you through the basics of setting up your first project, configuring modules, and deploying to production.',
      excerpt: 'A comprehensive guide to getting started with xnapify.',
      status: 'published',
      published_at: now,
      created_at: new Date(now.getTime() - 7 * 86400000),
      updated_at: now,
    },
    {
      title: 'Understanding the Extension System',
      slug: 'understanding-the-extension-system',
      content:
        'Extensions are a powerful way to add functionality to your application without modifying core code. Learn how to create, install, and manage extensions in this deep dive.',
      excerpt: 'Deep dive into the plug-and-play extension architecture.',
      status: 'published',
      published_at: new Date(now.getTime() - 3 * 86400000),
      created_at: new Date(now.getTime() - 5 * 86400000),
      updated_at: new Date(now.getTime() - 3 * 86400000),
    },
    {
      title: 'Building a Custom Admin Dashboard',
      slug: 'building-a-custom-admin-dashboard',
      content:
        'Learn how to build a custom admin dashboard with widgets, charts, and real-time data using the built-in component library.',
      excerpt: 'Step-by-step tutorial for building admin dashboards.',
      status: 'draft',
      created_at: new Date(now.getTime() - 2 * 86400000),
      updated_at: new Date(now.getTime() - 2 * 86400000),
    },
    {
      title: 'API Design Best Practices',
      slug: 'api-design-best-practices',
      content:
        'Discover the best practices for designing RESTful APIs, including proper error handling, pagination, filtering, and authentication patterns.',
      excerpt: 'Best practices for clean and maintainable API design.',
      status: 'published',
      published_at: new Date(now.getTime() - 1 * 86400000),
      created_at: new Date(now.getTime() - 4 * 86400000),
      updated_at: new Date(now.getTime() - 1 * 86400000),
    },
    {
      title: 'Migrating to Version 2.0',
      slug: 'migrating-to-version-2',
      content:
        'This guide covers all the breaking changes and migration steps needed to upgrade from version 1.x to 2.0, including database schema changes.',
      excerpt: 'Migration guide for the 2.0 release.',
      status: 'archived',
      published_at: new Date(now.getTime() - 30 * 86400000),
      created_at: new Date(now.getTime() - 60 * 86400000),
      updated_at: new Date(now.getTime() - 10 * 86400000),
    },
  ];

  await Post.bulkCreate(posts, { ignoreDuplicates: true });
}

/**
 * Revert the seed
 */
export async function down(_, { container }) {
  const { Post } = container.resolve('models');

  await Post.destroy({
    where: {
      slug: [
        'getting-started-with-xnapify',
        'understanding-the-extension-system',
        'building-a-custom-admin-dashboard',
        'api-design-best-practices',
        'migrating-to-version-2',
      ],
    },
    force: true,
  });
}
