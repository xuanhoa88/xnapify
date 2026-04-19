/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Box, Text } from '@radix-ui/themes';
import PropTypes from 'prop-types';

import Icon from '../../../Icon';

import s from './ValidationFailure.css';

export default function ValidationFailure({ message, active, onDismiss }) {
  if (!active) return null;
  return (
    <Box className={s.validationFailure} onClick={onDismiss}>
      <Text as='span' className={s.validationFailureLabel}>
        {message}
      </Text>
      <Icon name='x' size={15} className={s.jsonIconMiddle} />
    </Box>
  );
}

ValidationFailure.propTypes = {
  message: PropTypes.string.isRequired,
  active: PropTypes.bool.isRequired,
  onDismiss: PropTypes.func.isRequired,
};
