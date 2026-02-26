import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/main/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/meeting-copilot.db',
  },
});
