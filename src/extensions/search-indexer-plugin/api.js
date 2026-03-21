export default {
  async init(registry, _context) {
    registry.registerHook('search.indexers.register', async app => {
      const hook = app.get('container').resolve('hook');

      // Example: observe a custom entity lifecycle and index it
      hook('sample:entity').on('created', async ({ entity }) => {
        console.log('[SampleSearchIndexer] Indexing entity', entity.id);
        // In real app: await searchWorker.indexDocument(entity);
      });

      hook('sample:entity').on('deleted', async ({ entity_id }) => {
        console.log('[SampleSearchIndexer] Removing entity', entity_id);
        // In real app: await searchWorker.removeDocument(entity_id);
      });
    });
  },
};
