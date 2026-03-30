/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';

import { Link } from '@shared/renderer/components/History';

import s from './GuestMode.css';

/**
 * GuestMode Component
 * Login and Register buttons for guest users
 */
function GuestMode() {
  const { t } = useTranslation();

  return (
    <div className={s.guestMode}>
      <Link to='/login' className={s.loginBtn}>
        {t('navigation.login', 'Login')}
      </Link>
      <Link to='/register' className={s.registerBtn}>
        {t('navigation.register', 'Register')}
      </Link>
    </div>
  );
}

export default GuestMode;
