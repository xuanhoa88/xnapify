/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { useTranslation } from 'react-i18next';
import Tabs from '../../../../shared/renderer/components/Tabs';
import Icon from '../../../../shared/renderer/components/Icon';
import ProfileHeader from './components/ProfileHeader';
import PersonalInfoCard from './components/PersonalInfoCard';
import PreferencesCard from './components/PreferencesCard';
import SecurityCard from './components/SecurityCard';
import DeleteAccountCard from './components/DeleteAccountCard';
import s from './Profile.css';

function Profile() {
  const { t } = useTranslation();

  return (
    <div className={s.root}>
      <div className={s.wrapper}>
        <ProfileHeader />

        <Tabs defaultTab='personal'>
          <Tabs.List>
            <Tabs.Tab id='personal' icon={<Icon name='user' size={18} />}>
              {t('profile.personalInfo', 'Personal Info')}
            </Tabs.Tab>
            <Tabs.Tab
              id='preferences'
              icon={<Icon name='settings' size={18} />}
            >
              {t('profile.preferences', 'Preferences')}
            </Tabs.Tab>
            <Tabs.Tab id='security' icon={<Icon name='shield' size={18} />}>
              {t('profile.security', 'Security')}
            </Tabs.Tab>
            <Tabs.Tab id='danger' icon={<Icon name='trash' size={18} />}>
              {t('profile.dangerZone', 'Danger Zone')}
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panels>
            <Tabs.Panel id='personal'>
              <PersonalInfoCard />
            </Tabs.Panel>

            <Tabs.Panel id='preferences'>
              <PreferencesCard />
            </Tabs.Panel>

            <Tabs.Panel id='security'>
              <SecurityCard />
            </Tabs.Panel>

            <Tabs.Panel id='danger'>
              <DeleteAccountCard />
            </Tabs.Panel>
          </Tabs.Panels>
        </Tabs>
      </div>
    </div>
  );
}

export default Profile;
