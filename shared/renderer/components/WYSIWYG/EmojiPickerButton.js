/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';

import ContextMenu from '../ContextMenu';

import { COMMON_EMOJIS } from './constants';
import ToolbarButton from './ToolbarButton';
import Icons from './ToolbarIcon';

export default function EmojiPickerButton({ onSelect, title, disabled }) {
  return (
    <ContextMenu align='left'>
      <ContextMenu.Trigger
        as={ToolbarButton}
        icon={Icons.emoji}
        title={title}
        disabled={disabled}
      >
        {null}
      </ContextMenu.Trigger>

      <ContextMenu.Menu>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '4px',
            padding: '8px',
          }}
        >
          {COMMON_EMOJIS.map(emoji => (
            <button
              key={emoji}
              type='button'
              onClick={() => onSelect(emoji)}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                background: 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
              onMouseOver={e => {
                e.currentTarget.style.backgroundColor =
                  'var(--color-background-hover)';
              }}
              onFocus={e => {
                e.currentTarget.style.backgroundColor =
                  'var(--color-background-hover)';
              }}
              onMouseOut={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
              onBlur={e => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {emoji}
            </button>
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
