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
import s from './EmojiPickerButton.css';

const EMOJI_ICON = (
  <svg
    width='16'
    height='16'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2.5'
    strokeLinecap='round'
    strokeLinejoin='round'
  >
    <circle cx='12' cy='12' r='10'></circle>
    <path d='M8 14s1.5 2 4 2 4-2 4-2'></path>
    <line x1='9' y1='9' x2='9.01' y2='9'></line>
    <line x1='15' y1='9' x2='15.01' y2='9'></line>
  </svg>
);

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
        icon={EMOJI_ICON}
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
