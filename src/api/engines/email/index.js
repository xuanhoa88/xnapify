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
 * @example
 * // Access singleton instance
 * const manager = email.default;
 *
 * // Single email
 * await email.default.send({
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   html: '<p>Hello!</p>'
 * });
 *
 * // With template placeholders (LiquidJS)
 * await email.default.send({
 *   to: 'user@example.com',
 *   subject: 'Hi {{name}}',
 *   html: '<p>Hello {{name}}</p>',
 *   templateData: { name: 'John' }
 * });
 *
 * // Bulk emails (auto-offloads to worker for 5+ emails)
 * await email.default.send([
 *   { to: 'user1@example.com', subject: 'Hi', html: '<p>1</p>' },
 *   { to: 'user2@example.com', subject: 'Hi', html: '<p>2</p>' }
 * ]);
 *
 * @example
 * // Create isolated instance (for testing)
 * const testEmail = email.createFactory({ provider: 'memory' });
 * await testEmail.send({ to, subject, html });
 *
 * @example
 * // Add custom provider (cannot override existing)
 * class ResendProvider {
 *   async send(emailData) {
 *     // Custom send logic
 *     return { messageId: 'xxx', provider: 'resend' };
 *   }
 * }
 *
 * email.default.addProvider('resend', new ResendProvider());
 * await email.default.send({ to, subject, html }, { provider: 'resend' });
 */

import { createFactory } from './factory';

// Export factory for creating instances
export { createFactory };

/**
 * Singleton instance of EmailManager
 * Used by the application via email.default
 */
const email = createFactory();

export default email;
