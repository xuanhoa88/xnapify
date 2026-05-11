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
import PropTypes from 'prop-types';
import { useTranslation } from 'react-i18next';

import DeleteAccountCard from './components/DeleteAccountCard.js';
import PersonalInfoCard from './components/PersonalInfoCard.js';
import PreferencesCard from './components/PreferencesCard.js';
import ProfileHeader from './components/ProfileHeader.js';
import SecurityCard from './components/SecurityCard.js';

/**
 * Profile layout component natively migrating from pure CSS to absolute Box and Flex parameters.
 */
function Profile({ context }) {
  const { t } = useTranslation();

  return (
    <Box className='min-h-screen p-6 bg-slate-50'>
      <Box className='max-w-[860px] mx-auto'>
        <ProfileHeader />

        <Box className='mt-6'>
          <Tabs.Root defaultValue='personal'>
            <Box className='overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'>
              <Tabs.List className='min-w-max'>
                <Tabs.Trigger
                  value='personal'
                  className='cursor-pointer whitespace-nowrap'
                >
                  <span className='flex items-center gap-2'>
                    <PersonIcon width={18} height={18} />
                    {t('profile.personalInfo', 'Personal Info')}
                  </span>
                </Tabs.Trigger>
                <Tabs.Trigger
                  value='preferences'
                  className='cursor-pointer whitespace-nowrap'
                >
                  <span className='flex items-center gap-2'>
                    <GearIcon width={18} height={18} />
                    {t('profile.preferences', 'Preferences')}
                  </span>
                </Tabs.Trigger>
                <Tabs.Trigger
                  value='security'
                  className='cursor-pointer whitespace-nowrap'
                >
                  <span className='flex items-center gap-2'>
                    <LockClosedIcon width={18} height={18} />
                    {t('profile.security', 'Security')}
                  </span>
                </Tabs.Trigger>
                <Tabs.Trigger
                  value='danger'
                  className='cursor-pointer whitespace-nowrap'
                >
                  <span className='flex items-center gap-2'>
                    <TrashIcon width={18} height={18} />
                    {t('profile.dangerZone', 'Danger Zone')}
                  </span>
                </Tabs.Trigger>
              </Tabs.List>
            </Box>

            <Box pt='4'>
              <Tabs.Content value='personal'>
                <PersonalInfoCard context={context} />
              </Tabs.Content>

              <Tabs.Content value='preferences'>
                <PreferencesCard context={context} />
              </Tabs.Content>

              <Tabs.Content value='security'>
                <SecurityCard context={context} />
              </Tabs.Content>

              <Tabs.Content value='danger'>
                <DeleteAccountCard context={context} />
              </Tabs.Content>
            </Box>
          </Tabs.Root>
        </Box>
      </Box>
    </Box>
  );
}

Profile.propTypes = {
  context: PropTypes.shape({
    container: PropTypes.object.isRequired,
  }).isRequired,
};

export default Profile;
