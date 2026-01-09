/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/** @namespace Email controller for HTTP handling */
export * from './controllers';

/** @namespace Email action functions */
export { send } from './send';

/** @namespace Email manager class */
export { EmailManager } from './manager';

/** @namespace Email providers */
export { SmtpEmailProvider } from './providers/smtp';
export { SendGridEmailProvider } from './providers/sendgrid';
export { MailgunEmailProvider } from './providers/mailgun';
export { MemoryEmailProvider } from './providers/memory';
