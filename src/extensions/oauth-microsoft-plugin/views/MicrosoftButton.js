/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

function MicrosoftButton({ className }) {
  const { t } = useTranslation();

  return (
    <a href='/api/auth/oauth/microsoft' className={className}>
      <svg
        viewBox='0 0 24 24'
        width='18'
        height='18'
        xmlns='http://www.w3.org/2000/svg'
      >
        <path fill='#f35325' d='M1 1h10v10H1z' />
        <path fill='#81bc06' d='M12 1h10v10H12z' />
        <path fill='#05a6f0' d='M1 12h10v10H1z' />
        <path fill='#ffba08' d='M12 12h10v10H12z' />
      </svg>
      {t('login.oauthMicrosoftShort', 'Microsoft')}
    </a>
  );
}

MicrosoftButton.propTypes = {
  className: PropTypes.string,
};

export default MicrosoftButton;
