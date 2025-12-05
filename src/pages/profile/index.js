/**
 * React Starter Kit (https://github.com/xuanhoa88/rapid-rsk/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import Layout from '../../components/Layout';
import Profile from './Profile';

function action({ i18n }) {
  const title = i18n.t('navigation.profile', 'User Profile');

  return {
    title,
    component: (
      <Layout>
        <Profile title={title} />
      </Layout>
    ),
  };
}

export default [
  {
    path: '/profile',
  },
  action,
];
