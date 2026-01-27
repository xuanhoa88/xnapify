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
 * ## Features
 *
 * - **Multiple Providers**: SMTP, SendGrid, Mailgun, Memory with easy registration
 * - **Smart Worker Integration**: Auto-offload based on batch size, body size, attachments
 * - **Template Support**: LiquidJS templating for dynamic content
 * - **Validation**: Zod-based email validation
 * - **Graceful Shutdown**: Automatic cleanup on process termination
 *
 * ---
 *
 * @example <caption>Single Email</caption>
 * // Access singleton instance
 * const manager = email.default;
 *
 * // Single email (auto-decides, usually direct processing)
 * await email.default.send({
 *   to: 'user@example.com',
 *   subject: 'Welcome',
 *   html: '<p>Hello!</p>'
 * });
 *
 * @example <caption>Worker Control</caption>
 * // Force worker processing
 * await email.default.send({ to, subject, html }, { useWorker: true });
 *
 * // Force direct processing (bypass worker even for batch)
 * await email.default.send(emailList, { useWorker: false });
 *
 * @example <caption>Bulk Emails</caption>
 * // Bulk emails (auto-offloads to worker for 5+ emails)
 * await email.default.send([
 *   { to: 'user1@example.com', subject: 'Hi', html: '<p>1</p>' },
 *   { to: 'user2@example.com', subject: 'Hi', html: '<p>2</p>' }
 * ]);
 *
 * @example <caption>Templates with LiquidJS</caption>
 * // With template placeholders (LiquidJS)
 * await email.default.send({
 *   to: 'user@example.com',
 *   subject: 'Hi {{name}}',
 *   html: '<p>Hello {{name}}</p>',
 *   templateData: { name: 'John' }
 * });
 *
 * @example <caption>Create Isolated Instance</caption>
 * // Create isolated instance (for testing)
 * const testEmail = email.createFactory({ provider: 'memory' });
 * await testEmail.send({ to, subject, html });
 *
 * @example <caption>Custom Provider</caption>
 * // Add custom provider (cannot override existing)
 * class ResendProvider {
 *   async send(emailData) {
 *     return { messageId: 'xxx', provider: 'resend' };
 *   }
 * }
 *
 * email.default.addProvider('resend', new ResendProvider());
 * await email.default.send({ to, subject, html }, { provider: 'resend' });
 *
 * @example <caption>Lifecycle Management</caption>
 * // Get all registered providers
 * const providers = email.default.getProviderNames();
 * // ['memory', 'smtp', 'sendgrid', 'mailgun']
 *
 * // Check if provider exists
 * if (email.default.hasProvider('smtp')) {
 *   console.log('SMTP provider available');
 * }
 *
 * // Get provider instance
 * const smtpProvider = email.default.getProvider('smtp');
 *
 * // Get stats from all providers
 * const stats = email.default.getAllStats();
 * // {
 * //   memory: { sent: 10, failed: 0 },
 * //   smtp: { available: false },
 * //   ...
 * // }
 *
 * // Cleanup (automatically called on process termination)
 * await email.default.cleanup();
 *
 * @example <caption>Integration with Schedule Engine</caption>
 *
 * // Send weekly newsletter
 * schedule.register('weekly-newsletter', '0 9 * * 1', async () => {
 *   const subscribers = await getSubscribers();
 *
 *   await email.send(
 *     subscribers.map(user => ({
 *       to: user.email,
 *       subject: 'Weekly Newsletter',
 *       html: '<p>This week in...</p>',
 *       templateData: { name: user.name }
 *     }))
 *   );
 * });
 *
 * @example <caption>Integration with Queue Engine</caption>
 *
 * // Create an email delivery channel
 * const emails = queue('emails', { concurrency: 3 });
 *
 * emails.on('send', async (job) => {
 *   await email.send(job.data.emailData, job.data.options);
 * });
 *
 * // Queue email for delivery
 * queue.channel('emails').emit('send', {
 *   emailData: { to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' },
 *   options: { provider: 'sendgrid' }
 * });
 */

import { createFactory } from './factory';

// Export services
export * as services from './services';

// Export the class and factory for external use
export { createFactory };

/**
 * Singleton instance of EmailManager
 * Used by the application via email.default
 */
const email = createFactory();

export default email;
