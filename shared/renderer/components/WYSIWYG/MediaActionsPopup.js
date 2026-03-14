/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '../ContextMenu';

import ToolbarButton from './ToolbarButton';
import Icons from './ToolbarIcon';

/**
 * MediaActionsPopup — A toolbar button that opens a popover with media
 * actions (video, audio, youtube).
 *
 * @param {Object} props
 * @param {import('@tiptap/react').Editor} props.editor  Tiptap editor instance
 * @param {boolean}  [props.disabled]                    Disable the trigger button
 * @param {boolean}  [props.hasVideo]
 * @param {boolean}  [props.hasAudio]
 * @param {boolean}  [props.hasYoutube]
 */
export default function MediaActionsPopup({
  editor,
  disabled,
  hasVideo,
  hasAudio,
  hasYoutube,
}) {
  const { t } = useTranslation();

  return (
    <ContextMenu align='left'>
      <ContextMenu.Trigger
        as={ToolbarButton}
        icon={Icons.video}
        title={t('shared:form.wysiwyg.mediaActions', 'Media')}
        disabled={disabled}
      >
        {null}
      </ContextMenu.Trigger>

      <ContextMenu.Menu>
        {hasVideo && (
          <ContextMenu.Item
            icon={Icons.video}
            onClick={() => {
              const url = window.prompt('Video URL (MP4, WebM, etc.)');
              if (url) editor.chain().focus().setVideo({ src: url }).run();
            }}
          >
            {t('shared:form.wysiwyg.video', 'Video')}
          </ContextMenu.Item>
        )}
        {hasAudio && (
          <ContextMenu.Item
            icon={Icons.audio}
            onClick={() => {
              const url = window.prompt('Audio URL (MP3, WAV, etc.)');
              if (url) editor.chain().focus().setAudio({ src: url }).run();
            }}
          >
            {t('shared:form.wysiwyg.audio', 'Audio')}
          </ContextMenu.Item>
        )}
        {hasYoutube && (
          <ContextMenu.Item
            icon={Icons.youtube}
            onClick={() => {
              const url = window.prompt('YouTube Video URL');
              if (url)
                editor.chain().focus().setYoutubeVideo({ src: url }).run();
            }}
          >
            {t('shared:form.wysiwyg.youtube', 'YouTube')}
          </ContextMenu.Item>
        )}
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

MediaActionsPopup.propTypes = {
  editor: PropTypes.object.isRequired,
  disabled: PropTypes.bool,
  hasVideo: PropTypes.bool,
  hasAudio: PropTypes.bool,
  hasYoutube: PropTypes.bool,
};
