import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './api/services/database.ts',
  out: './migrations',
  dialect: 'sqlite',
  driver: 'd1',
  dbCredentials: {
    wranglerConfigPath: './wrangler.toml',
    dbName: 'openmeter-db'
  }
});