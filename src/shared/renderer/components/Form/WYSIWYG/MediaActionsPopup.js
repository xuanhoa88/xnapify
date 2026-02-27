/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';
import ToolbarButton from './ToolbarButton';
import Icons from './ToolbarIcon';
import s from './MediaActionsPopup.css';

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
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const run = command => {
    command();
    setIsOpen(false);
  };

  const actionItem = (icon, label, command, opts = {}) => (
    <button
      key={label}
      type='button'
      className={s.actionItem}
      onClick={() => run(command)}
      disabled={opts.disabled}
    >
      <span className={s.actionIcon}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div className={s.container} ref={containerRef}>
      <ToolbarButton
        icon={Icons.video}
        title={t('shared:form.wysiwyg.mediaActions', 'Media')}
        isActive={isOpen}
        onClick={() => setIsOpen(prev => !prev)}
        disabled={disabled}
      />

      {isOpen && (
        <div className={s.popover}>
          {hasVideo &&
            actionItem(
              Icons.video,
              t('shared:form.wysiwyg.video', 'Video'),
              () => {
                const url = window.prompt('Video URL (MP4, WebM, etc.)');
                if (url) editor.chain().focus().setVideo({ src: url }).run();
              },
            )}
          {hasAudio &&
            actionItem(
              Icons.audio,
              t('shared:form.wysiwyg.audio', 'Audio'),
              () => {
                const url = window.prompt('Audio URL (MP3, WAV, etc.)');
                if (url) editor.chain().focus().setAudio({ src: url }).run();
              },
            )}
          {hasYoutube &&
            actionItem(
              Icons.youtube,
              t('shared:form.wysiwyg.youtube', 'YouTube'),
              () => {
                const url = window.prompt('YouTube Video URL');
                if (url)
                  editor.chain().focus().setYoutubeVideo({ src: url }).run();
              },
            )}
        </div>
      )}
    </div>
  );
}

MediaActionsPopup.propTypes = {
  editor: PropTypes.object.isRequired,
  disabled: PropTypes.bool,
  hasVideo: PropTypes.bool,
  hasAudio: PropTypes.bool,
  hasYoutube: PropTypes.bool,
};
