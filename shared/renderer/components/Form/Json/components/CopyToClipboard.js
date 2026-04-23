/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useState, useCallback } from 'react';

import { Text } from '@radix-ui/themes';
import clsx from 'clsx';
import PropTypes from 'prop-types';

import Icon from '../../../Icon';
import { toType } from '../utils';

import s from './CopyToClipboard.css';

export default function CopyToClipboard({ src, enableClipboard }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const type = toType(src);
    let val;
    if (type === 'function' || type === 'regexp') {
      val = src.toString();
    } else {
      try {
        val = JSON.stringify(src, null, '  ');
      } catch {
        val = String(src);
      }
    }

    // Use modern clipboard API when available
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(val);
    }

    setCopied(true);
    if (typeof enableClipboard === 'function') {
      enableClipboard({ src, namespace: [] });
    }
    setTimeout(() => setCopied(false), 1500);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, enableClipboard]);

  if (!enableClipboard) return null;

  return (
    <Text
      as='span'
      className={clsx(s.copyContainer, 'jsv-copy-container')}
      title='Copy to clipboard'
    >
      <Text as='span' className={s.clipboardIcon} onClick={handleCopy}>
        <Icon name='CopyIcon' size={15} />
        {copied && (
          <Text as='span' className={s.clipboardChecked}>
            <Icon name='CheckIcon' size={15} />
          </Text>
        )}
      </Text>
    </Text>
  );
}

CopyToClipboard.propTypes = {
  src: PropTypes.any.isRequired,
  enableClipboard: PropTypes.oneOfType([PropTypes.func, PropTypes.bool])
    .isRequired,
};
