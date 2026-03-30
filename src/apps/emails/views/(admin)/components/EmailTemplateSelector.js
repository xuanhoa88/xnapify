/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ExtensionSlot from '@shared/extension/client/ExtensionSlot';
import ContextMenu from '@shared/renderer/components/ContextMenu';
import ToolbarButton from '@shared/renderer/components/WYSIWYG/ToolbarButton';
import Icons from '@shared/renderer/components/WYSIWYG/ToolbarIcon';

const PREDEFINED_TEMPLATES = [
  {
    id: 'welcome',
    label: 'Welcome Message',
    icon: Icons.details,
    html: '<h1>Welcome aboard!</h1><p>We are thrilled to have you with us. Here are a few things you can do to get started:</p><ul><li>Complete your profile</li><li>Check out our latest guides</li><li>Join the community</li></ul><p>If you have any questions, feel free to reply to this email!</p><p>Thanks,<br>The Team</p>',
  },
  {
    id: 'notification',
    label: 'Alert / Notification',
    icon: Icons.strikethrough,
    html: '<h2>Important Update</h2><blockquote><p>Your subscription will renew in 3 days. Please ensure your payment method is up to date.</p></blockquote><p>Visit your dashboard to review your settings.</p>',
  },
  {
    id: 'newsletter',
    label: 'Newsletter Layout',
    icon: Icons.horizontalRule,
    html: "<h1>Monthly Digest</h1><p>Here's what you missed this month:</p><hr><h3>Feature Highlight</h3><p>We just released a brand new tool to help you be more productive. Check it out now!</p><hr><h3>Community News</h3><p>Join our upcoming webinar next Thursday where we discuss the future roadmap.</p><br><p><small>You are receiving this because you subscribed to our newsletter.</small></p>",
  },
  {
    id: 'register',
    label: 'Registration Confirmation',
    icon: Icons.link,
    html: '<h1>Confirm Your Registration</h1><p>Hi {{name}},</p><p>Thank you for registering! Please click the link below to confirm your account:</p><p><a href="{{confirm_link}}">Confirm My Account</a></p><p>If you did not request this, please ignore this email.</p>',
  },
  {
    id: 'verify_email',
    label: 'Verify Email Address',
    icon: Icons.link,
    html: '<h2>Verify Your Email</h2><p>Hi {{name}},</p><p>To complete your profile setup, we just need to verify your email address:</p><p><a href="{{verify_link}}">Verify Email Address</a></p><p>Thanks!</p>',
  },
  {
    id: 'new_user',
    label: 'New Account Created',
    icon: Icons.details,
    html: '<h1>Welcome!</h1><p>An account has been created for you by an administrator.</p><ul><li><strong>Username:</strong> {{username}}</li><li><strong>Temporary Password:</strong> {{password}}</li></ul><p>Please log in and change your password immediately.</p><p><a href="{{login_url}}">Log In Here</a></p>',
  },
];

/**
 * EmailTemplateSelector — A WYSIWYG extension button that mounts into the toolbar.
 * It provides a dropdown to quickly insert predefined HTML structures into the editor.
 */
export default function EmailTemplateSelector({ editor }) {
  const { t } = useTranslation();

  const insertTemplate = html => {
    if (editor) {
      editor.chain().focus().insertContent(html).run();
    }
  };

  return (
    <ContextMenu align='left'>
      <ContextMenu.Trigger
        as={ToolbarButton}
        icon={Icons.template || Icons.details}
        title={t('admin:emails.templates.insertTemplate', 'Insert Template')}
        disabled={!editor}
      />

      <ContextMenu.Menu>
        <ContextMenu.Header
          title={t('admin:emails.templates.chooseBlock', 'Choose a Block...')}
        />
        {PREDEFINED_TEMPLATES.map(tmpl => (
          <ContextMenu.Item
            key={tmpl.id}
            icon={tmpl.icon}
            onClick={() => insertTemplate(tmpl.html)}
          >
            {t('admin:emails.templates.blocks.' + tmpl.id, tmpl.label)}
          </ContextMenu.Item>
        ))}
        {/* Allow users/extensions to easily add more templates dynamically */}
        <ExtensionSlot
          name='emails.templates.selector'
          editor={editor}
          onInsert={insertTemplate}
        />
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

EmailTemplateSelector.propTypes = {
  editor: PropTypes.object,
};
