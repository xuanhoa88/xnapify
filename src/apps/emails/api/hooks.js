/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { displayNameOf } from './services/send.service';

/**
 * Register email hooks for transactional emails.
 *
 * Each hook uses `emails:send` from the container — the global
 * sendTemplatedEmail service registered by the email module.
 */
export function registerEmailHooks(container) {
  const hook = container.resolve('hook');
  const sendTemplatedEmail = container.resolve('emails:send');

  if (!hook || !sendTemplatedEmail) {
    return;
  }

  // ---------------------------------------------------------------------------
  // auth:* — self-service
  // ---------------------------------------------------------------------------

  hook('auth').on('registered', async ({ email, user }) => {
    const displayName = displayNameOf(user);

    await sendTemplatedEmail(
      'welcome-email',
      {
        to: email,
        subject: `Welcome to ${process.env.RSK_APP_NAME}`,
        html: `<p>Hi {{ displayName }},</p>
               <p>Welcome to {{ appName }}! Your account has been successfully created.</p>
               <p><a href="{{ loginUrl }}">Go to Dashboard</a></p>`,
      },
      { user, displayName },
    );
  });

  hook('auth').on('password_reset_requested', async ({ email, resetLink }) => {
    await sendTemplatedEmail(
      'password-reset',
      {
        to: email,
        subject: `Password Reset — ${process.env.RSK_APP_NAME}`,
        html: `<p>You requested a password reset.</p>
               <p><a href="{{ resetLink }}">Reset Password</a></p>
               <p>This link will expire in 1 hour.</p>`,
      },
      { resetLink },
    );
  });

  // ---------------------------------------------------------------------------
  // admin:users:* — admin actions
  // ---------------------------------------------------------------------------

  hook('admin:users').on('created', async ({ email, password, user }) => {
    const displayName = displayNameOf(user);

    await sendTemplatedEmail(
      'admin-welcome-email',
      {
        to: email,
        subject: `Your ${process.env.RSK_APP_NAME} Account Has Been Created`,
        html: `<p>Hi {{ displayName }},</p>
               <p>An administrator has created an account for you on {{ appName }}.</p>
               <ul>
                 <li><strong>Email:</strong> {{ email }}</li>
                 <li><strong>Password:</strong> {{ password }}</li>
               </ul>
               <p><a href="{{ loginUrl }}">Sign In</a></p>
               <p>Please change your password after first login.</p>`,
      },
      { user, displayName, email, password },
    );
  });

  hook('admin:users').on('password_reset', async ({ email, password }) => {
    await sendTemplatedEmail(
      'admin-password-reset',
      {
        to: email,
        subject: `Security Alert — Your ${process.env.RSK_APP_NAME} Password Was Reset`,
        html: `<p>An administrator has reset the password for your {{ appName }} account.</p>
               <p>Your new temporary password is: <strong>{{ password }}</strong></p>
               <p><a href="{{ loginUrl }}">Sign In & Change Password</a></p>`,
      },
      { password },
    );
  });

  hook('admin:users').on('status_updated', async ({ email, is_active }) => {
    const status = is_active ? 'Active' : 'Inactive';

    await sendTemplatedEmail(
      'admin-status-update',
      {
        to: email,
        subject: `Account ${status} — ${process.env.RSK_APP_NAME}`,
        html: `<p>Your {{ appName }} account status has been changed by an administrator.</p>
               <p>Current status: <strong>{{ status }}</strong></p>
               {% unless is_active %}<p>If you believe this is an error, please contact support.</p>{% endunless %}
               {% if is_active %}<p><a href="{{ loginUrl }}">Go to Dashboard</a></p>{% endif %}`,
      },
      { is_active, status },
    );
  });

  hook('admin:users').on('deleted', async ({ email }) => {
    await sendTemplatedEmail('admin-account-deleted', {
      to: email,
      subject: `Account Removed — ${process.env.RSK_APP_NAME}`,
      html: `<p>An administrator has removed your account from {{ appName }}.</p>
               <p>If you believe this was done in error, please contact support.</p>`,
    });
  });

  // ---------------------------------------------------------------------------
  // profile:* — user self-service
  // ---------------------------------------------------------------------------

  hook('profile').on('password_changed', async ({ email }) => {
    await sendTemplatedEmail('profile-password-changed', {
      to: email,
      subject: `Security Alert — Password Changed on ${process.env.RSK_APP_NAME}`,
      html: `<p>Your password for your {{ appName }} account was recently changed.</p>
               <p>If you did not make this change, please <a href="{{ resetUrl }}">reset your password</a> immediately or contact support.</p>`,
    });
  });

  hook('profile').on('account_deleted', async ({ email }) => {
    await sendTemplatedEmail('profile-account-deleted', {
      to: email,
      subject: `Account Deleted — ${process.env.RSK_APP_NAME}`,
      html: `<p>Your {{ appName }} account has been successfully deleted as requested.</p>
               <p>If you did not request this, please contact support immediately.</p>`,
    });
  });

  // ---------------------------------------------------------------------------
  // files:* — collaboration
  // ---------------------------------------------------------------------------

  hook('files').on('shared', async ({ email, sharerEmail }) => {
    await sendTemplatedEmail(
      'file-shared',
      {
        to: email,
        subject: `${sharerEmail} shared a file with you on ${process.env.RSK_APP_NAME}`,
        html: `<p><strong>{{ sharerEmail }}</strong> has shared a file with you on {{ appName }}.</p>
               <p><a href="{{ driveUrl }}">Open Drive</a></p>`,
      },
      {
        sharerEmail,
        driveUrl: `${process.env.RSK_APP_URL}/drive`,
      },
    );
  });
}
