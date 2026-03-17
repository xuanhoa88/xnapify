/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import Button from '@shared/renderer/components/Button';
import { useHistory } from '@shared/renderer/components/History';
import Icon from '@shared/renderer/components/Icon';
import {
  getUserProfile,
  getImpersonatorId,
  stopImpersonating,
} from '@shared/renderer/redux';

import s from './ImpersonationBanner.css';

/**
 * Global banner shown when the current user is being impersonated by an administrator.
 */
function ImpersonationBanner() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const history = useHistory();
  const user = useSelector(getUserProfile);
  const impersonatorId = useSelector(getImpersonatorId);

  if (!impersonatorId) {
    return null;
  }

  const handleStop = async () => {
    try {
      await dispatch(stopImpersonating()).unwrap();
      history.push('/admin/users');
    } catch {
      // Error handled by Redux slice
    }
  };

  return (
    <div className={s.root}>
      <div className={s.content}>
        <Icon name='eye' size={20} className={s.icon} />
        <span className={s.text}>
          {t(
            'auth:impersonation.active',
            'You are currently impersonating {{name}}',
            {
              name:
                (user && user.profile && user.profile.display_name) ||
                (user && user.email),
            },
          )}
        </span>
      </div>
      <Button
        variant='ghost'
        size='small'
        onClick={handleStop}
        className={s.button}
      >
        {t('auth:impersonation.stop', 'Stop Impersonating')}
      </Button>
    </div>
  );
}

export default ImpersonationBanner;
