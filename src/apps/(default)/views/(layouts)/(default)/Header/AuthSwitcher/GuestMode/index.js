/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { Flex, Button } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { useHistory } from '@shared/renderer/components/History';

import s from './GuestMode.css';

/**
 * GuestMode Component
 * Login and Register buttons for guest users natively mapped with Radix Themes
 */
function GuestMode() {
  const { t } = useTranslation();
  const history = useHistory();

  return (
    <Flex align='center' gap='3'>
      <Button
        variant='ghost'
        color='gray'
        className={s.pointerBtn}
        onClick={() => history.push('/login')}
      >
        {t('navigation.login', 'Login')}
      </Button>
      <Button
        variant='solid'
        className={s.pointerBtn}
        onClick={() => history.push('/register')}
      >
        {t('navigation.register', 'Register')}
      </Button>
    </Flex>
  );
}

export default GuestMode;
