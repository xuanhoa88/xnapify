/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';
import { Link } from '../../../History';
import s from './AuthButtons.css';

/**
 * AuthButtons Component
 * Login and Register buttons for guest users
 */
function AuthButtons() {
  const { t } = useTranslation();

  return (
    <div className={s.authButtons}>
      <Link to='/login' className={s.loginBtn}>
        {t('navigation.login', 'Login')}
      </Link>
      <Link to='/register' className={s.registerBtn}>
        {t('navigation.register', 'Register')}
      </Link>
    </div>
  );
}

export default AuthButtons;
