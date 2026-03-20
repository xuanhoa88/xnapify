/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

export function registerEmailHooks(container) {
  // container is passed directly
  // const container = app.get('container');
  const hook = container.resolve('hook');
  const emailManager = container.resolve('email');
  const models = container.resolve('models');

  if (!hook || !emailManager || !models) {
    return;
  }

  const sendTemplatedEmail = async (slug, defaultPayload, templateData) => {
    try {
      let { subject, html } = defaultPayload;

      const template = await models.EmailTemplate.findOne({
        where: { slug, is_active: true },
      });

      if (template) {
        subject = template.subject || subject;
        html = template.html_body || html;
      }

      await emailManager.send(
        {
          to: defaultPayload.to,
          subject,
          html,
          templateData,
        },
        {
          useWorker: true,
          maxRetries: 3,
          throwOnError: true,
        },
      );
    } catch (err) {
      console.warn(
        `⚠️ Failed to send email [${slug}] to ${defaultPayload.to}:`,
        err.message,
      );
    }
  };

  // -------------------------------------------------------------
  // auth:* hooks (user self-service)
  // -------------------------------------------------------------

  hook('auth').on('registered', async payload => {
    const { email, user } = payload;
    const displayName =
      (user && user.profile && user.profile.display_name) || 'there';

    await sendTemplatedEmail(
      'welcome-email',
      {
        to: email,
        subject: `Welcome to ${process.env.RSK_APP_NAME}`,
        html: `<p>Hi {{displayName}},</p><p>Welcome to {{appName}}! Your account has been successfully created.</p>`,
      },
      {
        user,
        displayName,
        appName: process.env.RSK_APP_NAME,
      },
    );
  });

  hook('auth').on('password_reset_requested', async payload => {
    const { email, resetLink } = payload;

    await sendTemplatedEmail(
      'password-reset',
      {
        to: email,
        subject: 'Password Reset Request',
        html: `<p>You requested a password reset. Click the link below to reset your password:</p><p><a href="{{resetLink}}">Reset Password</a></p><p>This link will expire in 1 hour.</p>`,
      },
      {
        resetLink,
        appName: process.env.RSK_APP_NAME,
      },
    );
  });

  // -------------------------------------------------------------
  // admin:users:* hooks (admin actions)
  // -------------------------------------------------------------

  hook('admin:users').on('created', async payload => {
    const { email, password, user } = payload;
    const displayName =
      (user && user.profile && user.profile.display_name) || 'there';

    await sendTemplatedEmail(
      'admin-welcome-email',
      {
        to: email,
        subject: `Your ${process.env.RSK_APP_NAME} Account Has Been Created`,
        html: `
            <p>Hi {{displayName}},</p>
            <p>An administrator has created an account for you on {{appName}}.</p>
            <p>Your login details are:</p>
            <ul>
              <li><strong>Email:</strong> {{email}}</li>
              <li><strong>Password:</strong> {{password}}</li>
            </ul>
            <p>You can log in <a href="{{loginUrl}}">here</a>.</p>
            <p>Please change your password after logging in for the first time.</p>
          `,
      },
      {
        user,
        displayName,
        email,
        password,
        appName: process.env.RSK_APP_NAME,
        loginUrl: `${process.env.RSK_APP_URL}/login`,
      },
    );
  });

  hook('admin:users').on('password_reset', async payload => {
    const { email, password } = payload;

    await sendTemplatedEmail(
      'admin-password-reset',
      {
        to: email,
        subject: `Security Alert: Your ${process.env.RSK_APP_NAME} Password Was Reset`,
        html: `
            <p>Hi,</p>
            <p>An administrator has reset the password for your {{appName}} account.</p>
            <p>Your new temporary password is: <strong>{{password}}</strong></p>
            <p>Please log in and <a href="{{loginUrl}}">change your password</a> immediately.</p>
          `,
      },
      {
        password,
        appName: process.env.RSK_APP_NAME,
        loginUrl: `${process.env.RSK_APP_URL}/login`,
      },
    );
  });

  hook('admin:users').on('status_updated', async payload => {
    const { email, is_active } = payload;

    await sendTemplatedEmail(
      'admin-status-update',
      {
        to: email,
        subject: `Account Status Update: Your ${process.env.RSK_APP_NAME} Account is Now ${is_active ? 'Active' : 'Inactive'}`,
        html: `
            <p>Hi,</p>
            <p>An administrator has updated the status of your {{appName}} account.</p>
            <p>Your account is now: <strong>{{status}}</strong>.</p>
            {{#unless is_active}}<p>If you believe this is an error, please contact support.</p>{{/unless}}
          `,
      },
      {
        is_active,
        status: is_active ? 'Active' : 'Inactive',
        appName: process.env.RSK_APP_NAME,
      },
    );
  });

  hook('admin:users').on('deleted', async payload => {
    const { email } = payload;

    await sendTemplatedEmail(
      'admin-account-deleted',
      {
        to: email,
        subject: `Account Notice: Your ${process.env.RSK_APP_NAME} Account Has Been Deleted`,
        html: `
            <p>Hi,</p>
            <p>An administrator has removed your account from {{appName}}.</p>
            <p>If you have any questions or believe this was done in error, please contact support.</p>
          `,
      },
      {
        appName: process.env.RSK_APP_NAME,
      },
    );
  });

  // -------------------------------------------------------------
  // profile:* hooks (user self-service profile actions)
  // -------------------------------------------------------------

  hook('profile').on('password_changed', async payload => {
    const { email } = payload;

    await sendTemplatedEmail(
      'profile-password-changed',
      {
        to: email,
        subject: `Security Alert: Your ${process.env.RSK_APP_NAME} Password Was Changed`,
        html: `
            <p>Hi,</p>
            <p>Your password for your {{appName}} account was recently changed.</p>
            <p>If you did not make this change, please contact support immediately.</p>
          `,
      },
      {
        appName: process.env.RSK_APP_NAME,
      },
    );
  });

  hook('profile').on('account_deleted', async payload => {
    const { email } = payload;

    await sendTemplatedEmail(
      'profile-account-deleted',
      {
        to: email,
        subject: `Account Deleted: Your ${process.env.RSK_APP_NAME} Account Has Been Removed`,
        html: `
            <p>Hi,</p>
            <p>Your {{appName}} account has been successfully deleted as requested.</p>
            <p>If you did not request this, please contact support immediately.</p>
          `,
      },
      {
        appName: process.env.RSK_APP_NAME,
      },
    );
  });

  // -------------------------------------------------------------
  // files:* hooks (file sharing)
  // -------------------------------------------------------------

  hook('files').on('shared', async payload => {
    const { email, sharerEmail } = payload;

    await sendTemplatedEmail(
      'file-shared',
      {
        to: email,
        subject: `New File Shared With You on ${process.env.RSK_APP_NAME}`,
        html: `
            <p>Hi,</p>
            <p>{{sharerEmail}} has shared a file with you.</p>
            <p><a href="{{driveUrl}}">Open your Drive</a> to view it.</p>
          `,
      },
      {
        sharerEmail,
        appName: process.env.RSK_APP_NAME,
        driveUrl: `${process.env.RSK_APP_URL}/drive`,
      },
    );
  });
}
