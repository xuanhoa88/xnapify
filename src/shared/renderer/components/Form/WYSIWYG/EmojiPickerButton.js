/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { COMMON_EMOJIS } from './constants';
import ToolbarButton from './ToolbarButton';
import Icons from './ToolbarIcon';
import s from './EmojiPickerButton.css';

export default function EmojiPickerButton({ onSelect, title, disabled }) {
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

  return (
    <div className={s.emojiPickerContainer} ref={containerRef}>
      <ToolbarButton
        icon={Icons.emoji}
        title={title}
        isActive={isOpen}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
      />

      {isOpen && (
        <div className={s.emojiPopover}>
          <div className={s.emojiGrid}>
            {COMMON_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type='button'
                className={s.emojiOption}
                onClick={() => {
                  onSelect(emoji);
                  setIsOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

EmojiPickerButton.propTypes = {
  onSelect: PropTypes.func.isRequired,
  title: PropTypes.string,
  disabled: PropTypes.bool,
};
