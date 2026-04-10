/**
 * Seed initial settings data for Demo Settings Extension
 */
export async function up({ context }) {
  const { Setting } = context.models;

  await Setting.bulkCreate(
    [
      {
        namespace: 'demo_ext',
        key: 'DEMO_FEATURE_ENABLED',
        type: 'boolean',
        value: 'true',
        is_public: true,
        description: 'Enable the awesome demo feature',
      },
      {
        namespace: 'demo_ext',
        key: 'DEMO_GREETING_MESSAGE',
        type: 'string',
        value: 'Hello from the demo extension plugin!',
        is_public: true,
        description: 'Message to display when demo feature is enabled',
      },
      {
        namespace: 'demo_ext',
        key: 'DEMO_RETRY_COUNT',
        type: 'integer',
        value: '3',
        is_public: false,
        description: 'Number of times to retry a failed demo action',
      },
      {
        namespace: 'demo_ext',
        key: 'DEMO_JSON_SETTING',
        type: 'json',
        value: '{"name":"John Doe","age":30,"city":"New York"}',
        is_public: false,
        description: 'JSON setting for demo',
      },
    ],
    {
      updateOnDuplicate: ['value', 'description'],
    },
  );
}

export async function down({ context }) {
  const { Setting } = context.models;
  await Setting.destroy({
    where: {
      namespace: 'demo_ext',
    },
  });
}
