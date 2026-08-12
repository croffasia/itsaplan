import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// Load environment variables from the monorepo root .env. `quiet` drops the banner
// dotenv prints on every load.
config({ path: '../../.env', quiet: true });

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
