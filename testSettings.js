import 'dotenv-flow/config';
import { Container } from './shared/container/index.js';
import dbProvider from './shared/database/index.js';
import { createSettingsService } from './src/apps/settings/api/services/settings.service.js';

async function main() {
  const container = new Container();
  await dbProvider(container);

  const settings = createSettingsService(container);
  const all = await settings.getAll();
  console.log('Namespaces found:', Object.keys(all));
  if (all['demo_ext']) {
    console.log('demo_ext length:', all['demo_ext'].length);
  }
}
main()
  .catch(console.error)
  .finally(() => process.exit(0));
