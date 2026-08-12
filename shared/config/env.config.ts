import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  SERVICE_MODE: z.enum(['all', 'sync', 'leaderboard']).default('all'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // MongoDB Atlas
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().default('test'),

  // Supabase PostgreSQL
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  DATABASE_URL: z.string().optional(),

  // Sync Parameters
  CRON_SYNC_INTERVAL_SEC: z.coerce.number().default(30),
  SYNC_BATCH_SIZE: z.coerce.number().default(500),
  ENABLE_AUTO_CRON_SYNC: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(true),

  // Auth, Device Limits & Security
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  JWT_EXPIRY: z.string().default('24h'),
  ADMIN_API_KEY: z.string().default('technika_master_admin_secret_key_2026'),
  CORS_ORIGIN: z.string().default('*'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),

  // Campus Entry Special Event Concurrency Configuration
  CAMPUS_ENTRY_EVENT_IDS: z.string().default('EVT-ENTRY,CAMPUS_ENTRY,EVT-CAMPUS-ENTRY'),
  CAMPUS_ENTRY_MAX_DEVICES: z.coerce.number().default(2),
  STANDARD_EVENT_MAX_DEVICES: z.coerce.number().default(1),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables configuration:');
  console.error(JSON.stringify(parsedEnv.error.format(), null, 2));
  process.exit(1);
}

export const env = parsedEnv.data;
