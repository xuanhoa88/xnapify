/**
 * xnapify (https://github.com/xuanhoa88/xnapify/)
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.txt file in the root directory of this source tree.
 */

import { v4 as uuidv4 } from 'uuid';

const FACEBOOK_OAUTH_SETTINGS = [
  {
    namespace: 'auth',
    key: 'FACEBOOK_APP_ID',
    type: 'string',
    value: null,
    default_env_var: 'XNAPIFY_FACEBOOK_APP_ID',
    description: 'Facebook OAuth App ID',
  },
  {
    namespace: 'auth',
    key: 'FACEBOOK_APP_KEY',
    type: 'password',
    value: null,
    default_env_var: 'XNAPIFY_FACEBOOK_APP_KEY',
    description: 'Facebook OAuth App Secret Key',
  },
];

export async function up(_, { container }) {
  const { Setting } = container.resolve('models');

  const maxOrderRows = await Setting.findAll({
    attributes: ['namespace', 'sort_order'],
    raw: true,
  });

  let currentSort = {};
  for (const row of maxOrderRows) {
    if (
      !currentSort[row.namespace] ||
      row.sort_order > currentSort[row.namespace]
    ) {
      currentSort[row.namespace] = row.sort_order;
    }
  }

  const now = new Date();

  for (const setting of FACEBOOK_OAUTH_SETTINGS) {
    let order = currentSort[setting.namespace] || 0;
    order += 10;
    currentSort[setting.namespace] = order;

    await Setting.findOrCreate({
      where: { namespace: setting.namespace, key: setting.key },
      defaults: {
        id: uuidv4(),
        ...setting,
        sort_order: order,
        created_at: now,
        updated_at: now,
      },
    });
  }
}

export async function down(_, { container }) {
  const { Setting } = container.resolve('models');
  const keys = FACEBOOK_OAUTH_SETTINGS.map(s => s.key);

  await Setting.destroy({
    where: {
      namespace: 'auth',
      key: keys,
    },
  });
}
