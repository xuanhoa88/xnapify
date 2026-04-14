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

export async function up(container) {
  const { Setting } = container.resolve('models');

  const count = await Setting.count({
    where: { namespace: 'auth', key: 'FACEBOOK_APP_ID' },
  });

  if (count > 0) return;

  const maxOrderRows = await Setting.findAll({
    attributes: ['namespace', 'sort_order'],
    raw: true,
  });

  let currentSort = {};
  for (const row of maxOrderRows) {
    if (!currentSort[row.namespace] || row.sort_order > currentSort[row.namespace]) {
      currentSort[row.namespace] = row.sort_order;
    }
  }

  const batch = FACEBOOK_OAUTH_SETTINGS.map(s => {
    let order = currentSort[s.namespace] || 0;
    order += 10;
    currentSort[s.namespace] = order;

    return {
      ...s,
      sort_order: order,
      created_at: new Date(),
      updated_at: new Date(),
    };
  });

  await Setting.bulkCreate(batch);
}

export async function down(container) {
  const { Setting } = container.resolve('models');
  const keys = FACEBOOK_OAUTH_SETTINGS.map(s => s.key);

  await Setting.destroy({
    where: {
      namespace: 'auth',
      key: keys,
    },
  });
}
