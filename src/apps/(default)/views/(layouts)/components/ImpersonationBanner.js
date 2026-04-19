/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { EyeOpenIcon } from '@radix-ui/react-icons';
import { Flex, Text, Button } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { useHistory } from '@shared/renderer/components/History';
import {
  getUserProfile,
  getImpersonatorId,
  stopImpersonating,
} from '@shared/renderer/redux';

import s from './ImpersonationBanner.css';

/**
 * Global banner explicitly substituting legacy CSS values via Radix implementations seamlessly resolving absolute imports dynamically directly substituting classNames.
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
    <Flex
      align='center'
      justify='between'
      wrap='wrap'
      gap='3'
      className={s.bannerContainer}
    >
      <Flex align='center' gap='2'>
        <EyeOpenIcon width={20} height={20} className={s.bannerIcon} />
        <Text size='2' weight='medium'>
          {t(
            'auth:impersonation.active',
            'You are currently impersonating {{name}}',
            {
              name:
                (user && user.profile && user.profile.display_name) ||
                (user && user.email),
            },
          )}
        </Text>
      </Flex>
      <Button
        variant='ghost'
        size='1'
        onClick={handleStop}
        className={s.stopBtn}
      >
        {t('auth:impersonation.stop', 'Stop Impersonating')}
      </Button>
    </Flex>
  );
}

export default ImpersonationBanner;
