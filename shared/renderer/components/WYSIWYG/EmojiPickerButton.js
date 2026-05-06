/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { FaceIcon } from '@radix-ui/react-icons';
import { ScrollArea } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import ContextMenu from '../ContextMenu/index.js';

import { COMMON_EMOJIS } from './constants.js';
import ToolbarButton from './ToolbarButton.js';

import s from './EmojiPickerButton.css';

export default function EmojiPickerButton({ onSelect, title, disabled }) {
  return (
    <ContextMenu align='left'>
      <ContextMenu.Trigger asChild>
        <ToolbarButton
          icon={<FaceIcon width={16} height={16} />}
          title={title}
          disabled={disabled}
        />
      </ContextMenu.Trigger>

      <ContextMenu.Menu>
        <div className={s.emojiPopup}>
          <ScrollArea
            type='auto'
            scrollbars='vertical'
            className={s.scrollArea}
          >
            <div className={s.emojiGrid}>
              {COMMON_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  type='button'
                  onClick={() => onSelect(emoji)}
                  className={s.emojiButton}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </ContextMenu.Menu>
    </ContextMenu>
  );
}

EmojiPickerButton.propTypes = {
  onSelect: PropTypes.func.isRequired,
  title: PropTypes.string,
  disabled: PropTypes.bool,
};
