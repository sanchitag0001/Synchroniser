import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../../../shared/config/env.config';
import { logger } from '../../../shared/logger/pino.logger';
import { MongoDatabase } from '../../../shared/database/mongo.connection';
import { SupabaseDatabase } from '../../../shared/database/supabase.client';
import { IncrementalSyncEngine } from './engine/incremental.engine';
import { CronScheduler } from './scheduler/cron.scheduler';
import { createSyncRouter } from './routes/sync.routes';
import { errorHandler } from '../../../shared/middleware/error.middleware';
import { apiRateLimiter } from '../../../shared/middleware/rate_limit.middleware';

export async function bootstrapSyncService(): Promise<express.Application> {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '10mb' }));
  app.use(apiRateLimiter);

  // Initialize DB Connections
  try {
    await MongoDatabase.connect();
    await SupabaseDatabase.ping();
  } catch (err) {
    logger.error({ err }, '⚠️ Database connection issue on startup (will retry in background)');
  }

  // Initialize Sync Engine & Cron
  const syncEngine = new IncrementalSyncEngine();
  await syncEngine.initialize();

  // Run initial full sync on startup as required
  logger.info('🚀 Initiating startup synchronization cycle...');
  syncEngine.runSync(false, 'SCHEDULED').catch((err) => {
    logger.error({ err }, '❌ Startup sync cycle encountered an error');
  });

  const scheduler = new CronScheduler(syncEngine);
  scheduler.start();

  // Mount routes
  app.use('/sync', createSyncRouter(syncEngine));

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'sync-service',
      mongo: MongoDatabase.status,
      timestamp: new Date().toISOString(),
    });
  });

  app.use(errorHandler);
  return app;
}

// Standalone execution if launched directly
if (require.main === module) {
  bootstrapSyncService().then((app) => {
    app.listen(env.PORT, env.HOST, () => {
      logger.info(`🚀 Technika Sync Service running on http://${env.HOST}:${env.PORT}`);
    });
  });
}
