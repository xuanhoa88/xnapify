/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { FaceIcon } from '@radix-ui/react-icons';
import { IconButton } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import ContextMenu from '../ContextMenu';

import { COMMON_EMOJIS } from './constants';
import ToolbarButton from './ToolbarButton';

import s from './EmojiPickerButton.css';

export default function EmojiPickerButton({ onSelect, title, disabled }) {
  return (
    <ContextMenu align='left'>
      <ContextMenu.Trigger
        as={ToolbarButton}
        icon={<FaceIcon width={16} height={16} />}
        title={title}
        disabled={disabled}
      />

      <ContextMenu.Menu>
        <div className={s.emojiContainer}>
          {COMMON_EMOJIS.map(emoji => (
            <IconButton
              key={emoji}
              variant='ghost'
              color='gray'
              onClick={() => onSelect(emoji)}
              className={s.emojiButton}
            >
              {emoji}
            </IconButton>
          ))}
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
