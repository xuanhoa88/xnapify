import { useState, useRef, useEffect } from 'react';
/* eslint-disable css-modules/no-unused-class, css-modules/no-undef-class */
import PropTypes from 'prop-types';
import clsx from 'clsx';
import { COMMON_EMOJIS } from './constants';
import ts from './Toolbar.css';
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
      <button
        type='button'
        className={clsx(ts.toolbarBtn, { [ts.toolbarBtnActive]: isOpen })}
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        title={title}
        aria-label={title}
        aria-haspopup='true'
        aria-expanded={isOpen}
      >
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
      </button>

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
