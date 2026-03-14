/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import PluginSlot from '@shared/plugin/client/PluginSlot';
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
        {/* Allow users/plugins to easily add more templates dynamically */}
        <PluginSlot
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
