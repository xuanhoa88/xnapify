/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

function FacebookButton({ className }) {
  const { t } = useTranslation();

  return (
    <a href='/api/auth/oauth/facebook' className={className}>
      <svg
        viewBox='0 0 24 24'
        width='18'
        height='18'
        fill='#1877F2'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path d='M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14c-.326-.043-1.557-.14-2.857-.14C11.928 2 10 3.657 10 6.7v2.8H7v4h3V22h4v-8.5z' />
      </svg>
      {t('login.oauthFacebookShort', 'Facebook')}
    </a>
  );
}

FacebookButton.propTypes = {
  className: PropTypes.string,
};

export default FacebookButton;
