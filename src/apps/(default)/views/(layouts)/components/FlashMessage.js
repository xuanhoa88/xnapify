/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import Toast from '@shared/renderer/components/Toast/index.js';
import { features } from '@shared/renderer/redux/index.js';

const { getFlashMessage, clearFlashMessage } = features;

/**
 * Bridges the `ui.flashMessage` slot in the store to a Toast instance.
 *
 * Every layout mounts exactly one of these. Keeping it in a single component
 * matters: three hand-copied versions of this effect had already drifted apart.
 */
function FlashMessage() {
  const dispatch = useDispatch();
  const flashMessage = useSelector(getFlashMessage);
  const toastRef = useRef(null);

  useEffect(() => {
    if (!flashMessage || !toastRef.current) return;

    toastRef.current.show({
      variant: flashMessage.variant || 'info',
      message: flashMessage.message,
      title: flashMessage.title,
      // Passed through as-is so `duration: 0` still means "until dismissed".
      duration: flashMessage.duration,
    });

    // Clear from Redux state after displaying
    dispatch(clearFlashMessage());
  }, [flashMessage, dispatch]);

  return <Toast ref={toastRef} />;
}

export default FlashMessage;
