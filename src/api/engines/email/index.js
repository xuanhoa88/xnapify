/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Email Engine
 *
 * Provides email sending capabilities with multiple provider support
 * (SMTP, SendGrid, Mailgun, Memory). Automatically handles validation,
 * template rendering, and offloads to background workers for batch operations.
 *
 * @module engines/email
 *
 * @example
 * // 1. Via app provider (recommended)
 * const email = app.get('email');
 *
 * // Single email
 * await email.send({
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   html: '<p>Hello!</p>'
 * });
 *
 * // With template placeholders (LiquidJS)
 * await email.send({
 *   to: 'user@example.com',
 *   subject: 'Hi {{name}}',
 *   html: '<p>Hello {{name}}</p>',
 *   templateData: { name: 'John' }
 * });
 *
 * // Bulk emails (auto-offloads to worker for 5+ emails)
 * await email.send([
 *   { to: 'user1@example.com', subject: 'Hi', html: '<p>1</p>' },
 *   { to: 'user2@example.com', subject: 'Hi', html: '<p>2</p>' }
 * ]);
 *
 * @example
 * // 2. Direct import
 * await emailFactory.send({ to, subject, html });
 *
 * @example
 * // 3. Create isolated instance (for testing)
 * const testEmail = createFactory({ defaultProvider: 'memory' });
 * await testEmail.send({ to, subject, html });
 */

export { default as emailFactory, createFactory } from './manager';
