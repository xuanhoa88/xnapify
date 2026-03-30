/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from 'react';

import clsx from 'clsx';
import PropTypes from 'prop-types';

import s from './MentionList.css';

/**
 * MentionList — Renders the @ mention suggestion dropdown.
 *
 * This component is mounted inside a tippy.js popup by `suggestion.js`.
 * It exposes an `onKeyDown` imperative handle so the parent can forward
 * keyboard events for arrow-key navigation and Enter selection.
 */
const MentionList = forwardRef(function MentionList$({ items, command }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection whenever the items list changes (new query).
  useEffect(() => setSelectedIndex(0), [items]);

  const selectItem = useCallback(
    index => {
      const item = items[index];
      if (item) {
        command({ id: item });
      }
    },
    [items, command],
  );

  // Keyboard navigation handlers ------------------------------------------

  const upHandler = useCallback(() => {
    setSelectedIndex(prev => (prev + items.length - 1) % items.length);
  }, [items.length]);

  const downHandler = useCallback(() => {
    setSelectedIndex(prev => (prev + 1) % items.length);
  }, [items.length]);

  const enterHandler = useCallback(() => {
    selectItem(selectedIndex);
  }, [selectItem, selectedIndex]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          upHandler();
          return true;
        }
        if (event.key === 'ArrowDown') {
          downHandler();
          return true;
        }
        if (event.key === 'Enter') {
          enterHandler();
          return true;
        }
        return false;
      },
    }),
    [upHandler, downHandler, enterHandler],
  );

  // Render ----------------------------------------------------------------

  if (!items.length) {
    return (
      <div className={s.mentionList}>
        <div className={s.mentionEmpty}>No results</div>
      </div>
    );
  }

  return (
    <div className={s.mentionList} role='listbox'>
      {items.map((item, index) => (
        <button
          key={item}
          role='option'
          aria-selected={index === selectedIndex}
          className={clsx(s.mentionItem, {
            [s.isSelected]: index === selectedIndex,
          })}
          onClick={() => selectItem(index)}
          type='button'
        >
          @{item}
        </button>
      ))}
    </div>
  );
});

MentionList.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string).isRequired,
  command: PropTypes.func.isRequired,
};

export default MentionList;
