/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

// ---------------------------------------------------------------------------
// Shared responsive email wrapper
// ---------------------------------------------------------------------------
const wrap = body =>
  `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ subject }}</title>
  <style>
    body { margin:0; padding:0; background:#f4f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#24292e; }
    .wrapper { max-width:600px; margin:32px auto; background:#ffffff; border-radius:8px; border:1px solid #e1e4e8; overflow:hidden; }
    .header { background:#0d1117; padding:24px 32px; }
    .header img { height:28px; }
    .header h1 { color:#ffffff; font-size:18px; margin:0; font-weight:600; }
    .body { padding:32px; line-height:1.6; font-size:15px; }
    .body h2 { margin-top:0; font-size:20px; color:#24292e; }
    .body p { margin:0 0 16px; }
    .body a.btn { display:inline-block; padding:12px 24px; background:#2563eb; color:#ffffff !important; text-decoration:none; border-radius:6px; font-weight:600; font-size:14px; }
    .body a.btn:hover { background:#1d4ed8; }
    .body .code { display:inline-block; background:#f1f3f5; padding:8px 16px; border-radius:4px; font-family:'SF Mono',Consolas,monospace; font-size:14px; letter-spacing:1px; }
    .body .alert { padding:12px 16px; border-radius:6px; margin:16px 0; font-size:14px; }
    .body .alert-warning { background:#fff8e1; border-left:4px solid #f59e0b; }
    .body .alert-info { background:#e8f4fd; border-left:4px solid #2563eb; }
    .body .alert-danger { background:#fef2f2; border-left:4px solid #ef4444; }
    .footer { padding:24px 32px; background:#f6f8fa; border-top:1px solid #e1e4e8; font-size:12px; color:#6a737d; text-align:center; }
    .footer a { color:#0366d6; text-decoration:none; }
    .divider { border:none; border-top:1px solid #e1e4e8; margin:24px 0; }
    ul.details { list-style:none; padding:0; margin:16px 0; }
    ul.details li { padding:8px 0; border-bottom:1px solid #f0f0f0; }
    ul.details li:last-child { border-bottom:none; }
    ul.details strong { display:inline-block; min-width:120px; color:#57606a; }
  </style>
</head>
<body>
<div class="wrapper">
  <div class="header"><h1>{{ appName }}</h1></div>
  <div class="body">${body}</div>
  <div class="footer">
    <p>&copy; {{ now | date: "%Y" }} {{ appName }}. All rights reserved.</p>
    <p>This is an automated message — please do not reply directly.</p>
  </div>
</div>
</body>
</html>`.trim();

// ---------------------------------------------------------------------------
// Template catalogue
// ---------------------------------------------------------------------------
const TEMPLATES = [
  // =========================================================================
  // AUTH — self-service
  // =========================================================================
  {
    id: uuidv4(),
    slug: 'welcome-email',
    name: 'Welcome Email',
    subject: 'Welcome to {{ appName }}',
    html_body: wrap(`
    <h2>Welcome aboard, {{ displayName }}!</h2>
    <p>Your account has been successfully created. You now have access to the platform.</p>
    <div class="alert alert-info">
      <strong>Getting started:</strong> Visit your dashboard to configure your profile and explore available features.
    </div>
    <p style="text-align:center; margin:24px 0;">
      <a href="{{ loginUrl }}" class="btn">Go to Dashboard</a>
    </p>
    <hr class="divider">
    <p style="font-size:13px; color:#6a737d;">If you did not create this account, please disregard this email or contact our support team.</p>`),
    text_body:
      'Welcome to {{ appName }}, {{ displayName }}! Your account is ready. Log in at {{ loginUrl }}.',
    sample_data: {
      displayName: 'Alex Morgan',
      appName: 'xnapify',
      loginUrl: 'https://app.example.com/login',
      now: '2026-01-15T10:30:00.000Z',
    },
  },
  {
    id: uuidv4(),
    slug: 'password-reset',
    name: 'Password Reset Request',
    subject: 'Password Reset — {{ appName }}',
    html_body: wrap(`
    <h2>Password Reset Request</h2>
    <p>We received a request to reset the password for the account associated with this email address.</p>
    <p style="text-align:center; margin:24px 0;">
      <a href="{{ resetLink }}" class="btn">Reset Your Password</a>
    </p>
    <div class="alert alert-warning">
      <strong>Expires in 1 hour.</strong> If you did not request this change, no action is required — your password will remain unchanged.
    </div>
    <hr class="divider">
    <p style="font-size:13px; color:#6a737d;">For security, this link can only be used once. If it has expired, please submit a new request.</p>`),
    text_body:
      'Reset your password: {{ resetLink }} — This link expires in 1 hour.',
    sample_data: {
      resetLink: 'https://app.example.com/auth/reset?token=abc123',
      appName: 'xnapify',
      now: '2026-01-15T10:30:00.000Z',
    },
  },

  // =========================================================================
  // ADMIN — user management
  // =========================================================================
  {
    id: uuidv4(),
    slug: 'admin-welcome-email',
    name: 'Admin-Provisioned Account',
    subject: 'Your {{ appName }} Account Has Been Created',
    html_body: wrap(`
    <h2>Your account is ready</h2>
    <p>An administrator has provisioned an account for you on <strong>{{ appName }}</strong>.</p>
    <ul class="details">
      <li><strong>Email</strong> {{ email }}</li>
      <li><strong>Temporary Password</strong> <span class="code">{{ password }}</span></li>
    </ul>
    <p style="text-align:center; margin:24px 0;">
      <a href="{{ loginUrl }}" class="btn">Sign In</a>
    </p>
    <div class="alert alert-warning">
      <strong>Security:</strong> You will be required to change your password upon first login.
    </div>`),
    text_body:
      'Your {{ appName }} account: Email={{ email }}, Password={{ password }}. Sign in at {{ loginUrl }}.',
    sample_data: {
      displayName: 'Jordan Lee',
      email: 'jordan.lee@example.com',
      password: 'Temp!Pass42',
      appName: 'xnapify',
      loginUrl: 'https://app.example.com/login',
      now: '2026-01-15T10:30:00.000Z',
    },
  },
  {
    id: uuidv4(),
    slug: 'admin-password-reset',
    name: 'Admin Password Reset',
    subject: 'Security Alert — Your {{ appName }} Password Was Reset',
    html_body: wrap(`
    <h2>Password Reset by Administrator</h2>
    <p>An administrator has reset the password for your account.</p>
    <ul class="details">
      <li><strong>New Password</strong> <span class="code">{{ password }}</span></li>
    </ul>
    <p style="text-align:center; margin:24px 0;">
      <a href="{{ loginUrl }}" class="btn">Sign In &amp; Change Password</a>
    </p>
    <div class="alert alert-danger">
      <strong>Action required:</strong> For your security, please change this password immediately after signing in.
    </div>`),
    text_body:
      'Your password was reset by an admin. New password: {{ password }}. Change it at {{ loginUrl }}.',
    sample_data: {
      password: 'Reset!Pass99',
      appName: 'xnapify',
      loginUrl: 'https://app.example.com/login',
      now: '2026-01-15T10:30:00.000Z',
    },
  },
  {
    id: uuidv4(),
    slug: 'admin-status-update',
    name: 'Account Status Change',
    subject: 'Account {{ status }} — {{ appName }}',
    html_body: wrap(`
    <h2>Account Status Updated</h2>
    <p>Your {{ appName }} account status has been changed by an administrator.</p>
    <ul class="details">
      <li><strong>Current Status</strong> <span class="code">{{ status }}</span></li>
    </ul>
    {% unless is_active %}
    <div class="alert alert-danger">
      <strong>Access suspended.</strong> Your account has been deactivated. If you believe this is an error, please contact your organisation's administrator or our support team.
    </div>
    {% endunless %}
    {% if is_active %}
    <div class="alert alert-info">
      <strong>Access restored.</strong> You can now sign in and use all your assigned resources.
    </div>
    <p style="text-align:center; margin:24px 0;">
      <a href="{{ loginUrl }}" class="btn">Go to Dashboard</a>
    </p>
    {% endif %}`),
    text_body: 'Your {{ appName }} account is now {{ status }}.',
    sample_data: {
      is_active: false,
      status: 'Inactive',
      appName: 'xnapify',
      loginUrl: 'https://app.example.com/login',
      now: '2026-01-15T10:30:00.000Z',
    },
  },
  {
    id: uuidv4(),
    slug: 'admin-account-deleted',
    name: 'Account Deletion Notice',
    subject: 'Account Removed — {{ appName }}',
    html_body: wrap(`
    <h2>Account Removed</h2>
    <p>An administrator has removed your account from <strong>{{ appName }}</strong>.</p>
    <p>All associated data has been scheduled for permanent deletion in accordance with our data-retention policy.</p>
    <div class="alert alert-warning">
      <strong>Questions?</strong> If you believe this action was taken in error, please contact your organisation's administrator within 30 days to request account restoration.
    </div>`),
    text_body:
      'Your {{ appName }} account has been removed by an administrator.',
    sample_data: {
      appName: 'xnapify',
      now: '2026-01-15T10:30:00.000Z',
    },
  },

  // =========================================================================
  // PROFILE — self-service
  // =========================================================================
  {
    id: uuidv4(),
    slug: 'profile-password-changed',
    name: 'Password Changed Confirmation',
    subject: 'Security Alert — Password Changed on {{ appName }}',
    html_body: wrap(`
    <h2>Password Changed Successfully</h2>
    <p>The password for your <strong>{{ appName }}</strong> account was changed.</p>
    <ul class="details">
      <li><strong>When</strong> {{ now | date: "%B %d, %Y at %H:%M UTC" }}</li>
    </ul>
    <div class="alert alert-danger">
      <strong>Not you?</strong> If you did not make this change, your account may be compromised. Reset your password immediately and contact support.
    </div>
    <p style="text-align:center; margin:24px 0;">
      <a href="{{ resetUrl }}" class="btn">Reset Password</a>
    </p>`),
    text_body:
      'Your {{ appName }} password was changed. If this was not you, reset it immediately.',
    sample_data: {
      appName: 'xnapify',
      resetUrl: 'https://app.example.com/auth/reset',
      now: '2026-01-15T10:30:00.000Z',
    },
  },
  {
    id: uuidv4(),
    slug: 'profile-account-deleted',
    name: 'Account Self-Deletion Confirmation',
    subject: 'Account Deleted — {{ appName }}',
    html_body: wrap(`
    <h2>Account Deleted</h2>
    <p>Your <strong>{{ appName }}</strong> account has been successfully deleted as requested.</p>
    <p>All personal data will be permanently removed within 30 days in accordance with our privacy policy.</p>
    <div class="alert alert-warning">
      <strong>Changed your mind?</strong> Contact support within 30 days to request account restoration before permanent deletion.
    </div>
    <hr class="divider">
    <p style="font-size:13px; color:#6a737d;">We're sorry to see you go. Thank you for being part of the {{ appName }} community.</p>`),
    text_body:
      'Your {{ appName }} account has been deleted. Data will be purged within 30 days.',
    sample_data: {
      appName: 'xnapify',
      now: '2026-01-15T10:30:00.000Z',
    },
  },

  // =========================================================================
  // FILES — collaboration
  // =========================================================================
  {
    id: uuidv4(),
    slug: 'file-shared',
    name: 'File Shared Notification',
    subject: '{{ sharerEmail }} shared a file with you on {{ appName }}',
    html_body: wrap(`
    <h2>A File Was Shared With You</h2>
    <p><strong>{{ sharerEmail }}</strong> has shared a file with you on {{ appName }}.</p>
    <p style="text-align:center; margin:24px 0;">
      <a href="{{ driveUrl }}" class="btn">Open Drive</a>
    </p>
    <hr class="divider">
    <p style="font-size:13px; color:#6a737d;">You are receiving this because someone shared a file with your email address. If unexpected, you can safely ignore this message.</p>`),
    text_body:
      '{{ sharerEmail }} shared a file with you. View it at {{ driveUrl }}.',
    sample_data: {
      sharerEmail: 'alex.morgan@example.com',
      appName: 'xnapify',
      driveUrl: 'https://app.example.com/drive',
      now: '2026-01-15T10:30:00.000Z',
    },
  },
];

// ---------------------------------------------------------------------------
// Seed lifecycle
// ---------------------------------------------------------------------------

/**
 * Seed default transactional email templates.
 * Uses findOrCreate for idempotency — safe to re-run without duplicates.
 */
export async function up(_, { container }) {
  const { EmailTemplate } = container.resolve('models');
  const now = new Date();

  for (const tpl of TEMPLATES) {
    await EmailTemplate.findOrCreate({
      where: { slug: tpl.slug },
      defaults: {
        ...tpl,
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    });
  }
}

/**
 * Revert the seed
 */
export async function down({ Sequelize }, { container }) {
  const { EmailTemplate } = container.resolve('models');
  const { Op } = Sequelize;

  await EmailTemplate.destroy({
    where: {
      slug: { [Op.in]: TEMPLATES.map(t => t.slug) },
    },
    force: true,
  });
}
