/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

/**
 * Templated Email Service
 *
 * Provides a reusable `sendTemplatedEmail` function that can be resolved
 * from the container by any module or extension:
 *
 *   const sendTemplatedEmail = container.resolve('emails:send');
 *   await sendTemplatedEmail('welcome-email', { to: email, ... }, { name });
 *
 * Flow:
 * 1. Looks up `EmailTemplate` by slug (DB-managed template).
 * 2. Falls back to `defaultPayload.subject / html` if no template found.
 * 3. Passes `text_body` from DB template as plain-text fallback.
 * 4. Injects base variables (appName, loginUrl, now, etc.).
 * 5. Renders all fields through LiquidJS with the merged templateData.
 */

/** Common variables injected into every email */
export function baseVars() {
  return {
    appName: process.env.XNAPIFY_PUBLIC_APP_NAME,
    loginUrl: `${process.env.XNAPIFY_PUBLIC_APP_URL}/login`,
    resetUrl: `${process.env.XNAPIFY_PUBLIC_APP_URL}/auth/reset`,
    supportUrl: `${process.env.XNAPIFY_PUBLIC_APP_URL}/support`,
    now: new Date().toISOString(),
    year: new Date().getFullYear(),
  };
}

/** Resolve display name from a user object */
export function displayNameOf(user) {
  return (user && user.profile && user.profile.display_name) || 'there';
}

/**
 * Create the sendTemplatedEmail function bound to the container's services.
 *
 * @param {Object} container - App container
 * @returns {Function} sendTemplatedEmail(slug, defaultPayload, templateData)
 */
export function createSendTemplatedEmail(container) {
  const emailManager = container.resolve('email');
  const models = container.resolve('models');

  if (!emailManager || !models) {
    return async () => {
      console.warn('⚠️ sendTemplatedEmail: email or models not available');
    };
  }

  /**
   * Send a templated email.
   *
   * @param {string} slug - Template slug (e.g. 'welcome-email')
   * @param {Object} defaultPayload - Fallback email content
   * @param {string} defaultPayload.to - Recipient email address
   * @param {string} defaultPayload.subject - Fallback subject
   * @param {string} defaultPayload.html - Fallback HTML body
   * @param {Object} [templateData={}] - Variables for LiquidJS rendering
   * @returns {Promise<void>}
   */
  return async function sendTemplatedEmail(
    slug,
    defaultPayload,
    templateData = {},
  ) {
    try {
      let { subject, html } = defaultPayload;
      let text;

      const template = await models.EmailTemplate.findOne({
        where: { slug, is_active: true },
      });

      if (template) {
        subject = template.subject || subject;
        html = template.html_body || html;
        text = template.text_body || undefined;
      }

      // Merge base variables, caller-provided data, and rendered subject
      const data = { ...baseVars(), ...templateData, subject };

      await emailManager.send(
        { to: defaultPayload.to, subject, html, text, templateData: data },
        { useWorker: true, maxRetries: 3, throwOnError: true },
      );
    } catch (err) {
      console.warn(
        `⚠️ Failed to send email [${slug}] to ${defaultPayload.to}:`,
        err.message,
      );
    }
  };
}
