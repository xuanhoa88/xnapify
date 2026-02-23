/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import ToolbarButton from './ToolbarButton';
import s from './ColorPickerPopup.css';

/**
 * ColorPickerPopup — A toolbar button that opens a popover with a color
 * picker and an optional "Reset" button.
 *
 * @param {Object}   props
 * @param {React.ReactNode} props.icon        Icon for the toolbar button
 * @param {string}   props.title              Tooltip / aria-label
 * @param {string}   props.value              Current color value (hex)
 * @param {string}   props.defaultValue       Fallback when no color is set
 * @param {boolean}  props.isActive           Whether the mark is active
 * @param {Function} props.onChange           Called with the new color string
 * @param {Function} [props.onReset]          Called when "Reset" is clicked
 * @param {string}   [props.resetLabel]       Label for the reset button
 * @param {boolean}  [props.disabled]         Disable the trigger button
 */
export default function ColorPickerPopup({
  icon,
  title,
  value,
  defaultValue,
  isActive,
  onChange,
  onReset,
  resetLabel = 'Reset',
  disabled,
}) {
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
    <div className={s.container} ref={containerRef}>
      <ToolbarButton
        icon={icon}
        title={title}
        isActive={isOpen || isActive}
        onClick={() => setIsOpen(prev => !prev)}
        disabled={disabled}
      />

      {isOpen && (
        <div className={s.popover}>
          <input
            type='color'
            className={s.colorInput}
            value={value || defaultValue}
            onInput={e => onChange(e.target.value)}
          />
          {onReset && (
            <button
              type='button'
              className={s.resetBtn}
              onClick={() => {
                onReset();
                setIsOpen(false);
              }}
            >
              {resetLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

ColorPickerPopup.propTypes = {
  icon: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  value: PropTypes.string,
  defaultValue: PropTypes.string,
  isActive: PropTypes.bool,
  onChange: PropTypes.func.isRequired,
  onReset: PropTypes.func,
  resetLabel: PropTypes.string,
  disabled: PropTypes.bool,
};
