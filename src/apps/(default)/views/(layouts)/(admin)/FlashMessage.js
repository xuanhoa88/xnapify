/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  getFlashMessage,
  clearFlashMessage,
} from '../../../../../shared/renderer/redux';
import Toast from '../../../../../shared/renderer/components/Toast';

function FlashMessage() {
  const dispatch = useDispatch();
  const flashMessage = useSelector(getFlashMessage);
  const toastRef = useRef(null);

  useEffect(() => {
    if (flashMessage && toastRef.current) {
      // Display the flash message
      toastRef.current.show({
        variant: flashMessage.variant || 'info',
        message: flashMessage.message,
        title: flashMessage.title,
        duration: flashMessage.duration || 4000,
      });

      // Clear from Redux state after displaying
      dispatch(clearFlashMessage());
    }
  }, [flashMessage, dispatch]);

  return <Toast ref={toastRef} />;
}

export default FlashMessage;
