/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import {
  PersonIcon,
  GearIcon,
  LockClosedIcon,
  TrashIcon,
} from '@radix-ui/react-icons';
import { Box, Tabs } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import DeleteAccountCard from './components/DeleteAccountCard';
import PersonalInfoCard from './components/PersonalInfoCard';
import PreferencesCard from './components/PreferencesCard';
import ProfileHeader from './components/ProfileHeader';
import SecurityCard from './components/SecurityCard';

import s from './Profile.css';

/**
 * Profile layout component natively migrating from pure CSS to absolute Box and Flex parameters.
 */
function Profile() {
  const { t } = useTranslation();

  return (
    <Box className={s.pageContainer}>
      <Box className={s.contentWrapper}>
        <ProfileHeader />

        <Box className={s.tabsContainer}>
          <Tabs.Root defaultValue='personal'>
            <Tabs.List>
              <Tabs.Trigger value='personal'>
                <Box className={s.tabIcon}>
                  <PersonIcon width={18} height={18} />
                </Box>
                {t('profile.personalInfo', 'Personal Info')}
              </Tabs.Trigger>
              <Tabs.Trigger value='preferences'>
                <Box className={s.tabIcon}>
                  <GearIcon width={18} height={18} />
                </Box>
                {t('profile.preferences', 'Preferences')}
              </Tabs.Trigger>
              <Tabs.Trigger value='security'>
                <Box className={s.tabIcon}>
                  <LockClosedIcon width={18} height={18} />
                </Box>
                {t('profile.security', 'Security')}
              </Tabs.Trigger>
              <Tabs.Trigger value='danger'>
                <Box className={s.tabIcon}>
                  <TrashIcon width={18} height={18} />
                </Box>
                {t('profile.dangerZone', 'Danger Zone')}
              </Tabs.Trigger>
            </Tabs.List>

            <Box pt='4'>
              <Tabs.Content value='personal'>
                <PersonalInfoCard />
              </Tabs.Content>

              <Tabs.Content value='preferences'>
                <PreferencesCard />
              </Tabs.Content>

              <Tabs.Content value='security'>
                <SecurityCard />
              </Tabs.Content>

              <Tabs.Content value='danger'>
                <DeleteAccountCard />
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Box>
      </Box>
    </Box>
  );
}

export default Profile;
