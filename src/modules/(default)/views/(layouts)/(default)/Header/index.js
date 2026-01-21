/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';
import { Link } from '../../../../../../components/History';
import LanguageSwitcher from './LanguageSwitcher';
import AuthSwitcher from './AuthSwitcher';
import s from './Header.css';

/**
 * Header Component
 *
 * Main navigation header with brand, language switcher, and user authentication.
 * Shows login/register buttons for guests and profile dropdown for authenticated users.
 */
function Header() {
  const { t } = useTranslation();

  return (
    <div className={s.navbar}>
      <div className={s.navContainer}>
        {/* Left: Brand */}
        <Link className={s.brand} to='/'>
          <img
            src='/rsk_38x38.png'
            srcSet='/rsk_72x72.png 2x'
            width='38'
            height='38'
            alt='RSK'
          />
          <span className={s.brandTxt}>{t('header.brand')}</span>
        </Link>

        {/* Right: Language Switcher + Auth Switcher */}
        <div className={s.rightSection}>
          <LanguageSwitcher />
          <AuthSwitcher />
        </div>
      </div>
    </div>
  );
}

export default Header;
