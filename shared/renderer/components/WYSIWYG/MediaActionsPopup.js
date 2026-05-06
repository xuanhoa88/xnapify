/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { SpeakerLoudIcon, VideoIcon } from '@radix-ui/react-icons';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import ContextMenu from '../ContextMenu/index.js';

import ToolbarButton from './ToolbarButton.js';

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
 * @param {Function} props.openPrompt                    Prompt modal opener
 */
export default function MediaActionsPopup({
  editor,
  disabled,
  hasVideo,
  hasAudio,
  hasYoutube,
  openPrompt,
}) {
  const { t } = useTranslation();

  return (
    <ContextMenu align='left'>
      <ContextMenu.Trigger asChild>
        <ToolbarButton
          icon={<VideoIcon width={16} height={16} />}
          title={t('common:form.wysiwyg.mediaActions', 'Media')}
          disabled={disabled}
        />
      </ContextMenu.Trigger>

      <ContextMenu.Menu>
        {hasVideo && (
          <ContextMenu.Item
            icon={<VideoIcon width={16} height={16} />}
            onClick={() => {
              openPrompt({
                title: t('common:form.wysiwyg.video', 'Video'),
                label: t(
                  'common:form.wysiwyg.videoUrl',
                  'Video URL (MP4, WebM, etc.)',
                ),
                slotName: 'wysiwyg.prompt.video',
                onSubmit: url => {
                  if (url) editor.chain().focus().setVideo({ src: url }).run();
                },
              });
            }}
          >
            {t('common:form.wysiwyg.video', 'Video')}
          </ContextMenu.Item>
        )}
        {hasAudio && (
          <ContextMenu.Item
            icon={<SpeakerLoudIcon width={16} height={16} />}
            onClick={() => {
              openPrompt({
                title: t('common:form.wysiwyg.audio', 'Audio'),
                label: t(
                  'common:form.wysiwyg.audioUrl',
                  'Audio URL (MP3, WAV, etc.)',
                ),
                slotName: 'wysiwyg.prompt.audio',
                onSubmit: url => {
                  if (url) editor.chain().focus().setAudio({ src: url }).run();
                },
              });
            }}
          >
            {t('common:form.wysiwyg.audio', 'Audio')}
          </ContextMenu.Item>
        )}
        {hasYoutube && (
          <ContextMenu.Item
            icon={<VideoIcon width={16} height={16} />}
            onClick={() => {
              openPrompt({
                title: t('common:form.wysiwyg.youtube', 'YouTube'),
                label: t('common:form.wysiwyg.youtubeUrl', 'YouTube Video URL'),
                slotName: 'wysiwyg.prompt.youtube',
                onSubmit: url => {
                  if (url)
                    editor.chain().focus().setYoutubeVideo({ src: url }).run();
                },
              });
            }}
          >
            {t('common:form.wysiwyg.youtube', 'YouTube')}
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
  openPrompt: PropTypes.func.isRequired,
};
