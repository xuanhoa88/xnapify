/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Button, Box } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import ContextMenu from '../ContextMenu';

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
  return (
    <ContextMenu align='left'>
      <ContextMenu.Trigger
        as={ToolbarButton}
        icon={icon}
        title={title}
        isActive={isActive}
        disabled={disabled}
      />

      <ContextMenu.Menu>
        <div className={s.popupContainer}>
          <Box
            as='input'
            type='color'
            className={s.colorInput}
            value={value || defaultValue}
            onInput={e => onChange(e.target.value)}
          />
          {onReset && (
            <Button variant='soft' color='gray' size='1' onClick={onReset}>
              {resetLabel}
            </Button>
          )}
        </div>
      </ContextMenu.Menu>
    </ContextMenu>
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
