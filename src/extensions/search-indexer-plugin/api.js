export default {
  async init(registry, _context) {
    registry.registerHook('search:indexers', async hook => {
      hook.on('register', container => {
        const appHook = container.resolve('hook');

        // Example: observe a custom entity lifecycle and index it
        appHook('sample:entity').on('created', async ({ entity }) => {
          console.log('[SampleSearchIndexer] Indexing entity', entity.id);
          // In real app: await searchWorker.indexDocument(entity);
        });

        appHook('sample:entity').on('deleted', async ({ entity_id }) => {
          console.log('[SampleSearchIndexer] Removing entity', entity_id);
          // In real app: await searchWorker.removeDocument(entity_id);
        });
      });
    });
  },
};
