/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

const demoListings = [
  {
    id: uuidv4(),
    name: 'OAuth2 Provider',
    key: 'oauth2-provider',
    description:
      'Full OAuth2 authorization server with support for authorization code, client credentials, and refresh token grants. Includes admin UI for managing clients and scopes.',
    short_description: 'OAuth2 authorization server with admin UI',
    category: 'authentication',
    tags: JSON.stringify(['oauth', 'auth', 'sso', 'security']),
    icon: null,
    screenshots: JSON.stringify([]),
    version: '1.2.0',
    author: 'RSK Team',
    type: 'plugin',
    install_count: 1245,
    compatibility: '2.0',
    status: 'published',
    published_at: new Date('2026-01-15'),
  },
  {
    id: uuidv4(),
    name: 'S3 File Storage',
    key: 's3-file-storage',
    description:
      'AWS S3 file storage adapter for the fs engine. Supports multi-part upload, signed URLs, and CDN integration.',
    short_description: 'AWS S3 storage adapter with CDN support',
    category: 'storage',
    tags: JSON.stringify(['s3', 'aws', 'storage', 'cdn']),
    icon: null,
    screenshots: JSON.stringify([]),
    version: '2.0.1',
    author: 'RSK Team',
    type: 'plugin',
    install_count: 892,
    compatibility: '2.0',
    status: 'published',
    published_at: new Date('2026-02-01'),
  },
  {
    id: uuidv4(),
    name: 'Blog Module',
    key: 'blog-module',
    description:
      'Full-featured blog module with markdown editor, categories, tags, SEO metadata, RSS feeds, and comment system.',
    short_description: 'Blog with markdown, categories, and RSS',
    category: 'content',
    tags: JSON.stringify(['blog', 'cms', 'markdown', 'rss']),
    icon: null,
    screenshots: JSON.stringify([]),
    version: '1.0.0',
    author: 'Community',
    type: 'module',
    install_count: 567,
    compatibility: '2.0',
    status: 'published',
    published_at: new Date('2026-02-15'),
  },
  {
    id: uuidv4(),
    name: 'Stripe Payments',
    key: 'stripe-payments',
    description:
      'Stripe payment integration with checkout sessions, subscriptions, webhooks, and invoice management.',
    short_description: 'Stripe checkout, subscriptions, and webhooks',
    category: 'payment',
    tags: JSON.stringify(['stripe', 'payments', 'subscriptions', 'billing']),
    icon: null,
    screenshots: JSON.stringify([]),
    version: '1.1.0',
    author: 'Community',
    type: 'plugin',
    install_count: 2310,
    compatibility: '2.0',
    status: 'published',
    is_featured: true,
    published_at: new Date('2026-01-20'),
  },
  {
    id: uuidv4(),
    name: 'Analytics Dashboard',
    key: 'analytics-dashboard',
    description:
      'User activity analytics with charts, funnel analysis, session tracking, and export to CSV/PDF.',
    short_description: 'User analytics with charts and exports',
    category: 'analytics',
    tags: JSON.stringify(['analytics', 'charts', 'reporting', 'dashboard']),
    icon: null,
    screenshots: JSON.stringify([]),
    version: '1.3.0',
    author: 'RSK Team',
    type: 'module',
    install_count: 1580,
    compatibility: '2.0',
    status: 'published',
    is_featured: true,
    published_at: new Date('2026-03-01'),
  },
];

/**
 * Run the seed — insert demo marketplace listings
 */
export async function up(_, { container }) {
  const { MarketplaceListing } = container.resolve('models');
  const now = new Date();

  const listings = demoListings.map(listing => ({
    ...listing,
    created_at: now,
    updated_at: now,
  }));

  await MarketplaceListing.bulkCreate(listings);
}

/**
 * Revert the seed
 */
export async function down({ Sequelize }, { container }) {
  const { MarketplaceListing } = container.resolve('models');
  const { Op } = Sequelize;

  const keys = demoListings.map(l => l.key);
  await MarketplaceListing.destroy({
    where: { key: { [Op.in]: keys } },
    force: true,
  });
}
