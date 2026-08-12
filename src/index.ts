import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../shared/config/env.config';
import { logger } from '../shared/logger/pino.logger';
import { MongoDatabase } from '../shared/database/mongo.connection';
import { SupabaseDatabase } from '../shared/database/supabase.client';
import { errorHandler } from '../shared/middleware/error.middleware';
import { apiRateLimiter } from '../shared/middleware/rate_limit.middleware';

// Sync Service components
import { IncrementalSyncEngine } from '../apps/sync-service/src/engine/incremental.engine';
import { CronScheduler } from '../apps/sync-service/src/scheduler/cron.scheduler';
import { createSyncRouter } from '../apps/sync-service/src/routes/sync.routes';

// Leaderboard Service components
import { createAuthRouter } from '../apps/leaderboard-service/src/routes/auth.routes';
import { createEventRouter } from '../apps/leaderboard-service/src/routes/event.routes';
import { createNotificationRouter } from '../apps/leaderboard-service/src/routes/notification.routes';
import { createContactRouter } from '../apps/leaderboard-service/src/routes/contact.routes';
import { createAdminRouter } from '../apps/leaderboard-service/src/routes/admin.routes';

async function main() {
  logger.info({ mode: env.SERVICE_MODE, nodeEnv: env.NODE_ENV }, '🌟 Starting Technika Backend Gateway...');

  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '10mb' }));
  app.use(apiRateLimiter);

  // 1. Initialize DB connections
  try {
    if (env.SERVICE_MODE === 'all' || env.SERVICE_MODE === 'sync') {
      await MongoDatabase.connect();
    }
    await SupabaseDatabase.ping();
  } catch (err) {
    logger.error({ err }, '⚠️ Initial DB connection attempt failed (auto-reconnect active)');
  }

  let syncEngineInstance: IncrementalSyncEngine | undefined;

  // 2. Mount Sync Service (if enabled)
  if (env.SERVICE_MODE === 'all' || env.SERVICE_MODE === 'sync') {
    syncEngineInstance = new IncrementalSyncEngine();
    await syncEngineInstance.initialize();

    // Trigger initial sync on startup
    logger.info('🚀 Triggering initial startup sync cycle...');
    syncEngineInstance.runSync(false, 'SCHEDULED').catch((err: any) => {
      logger.error({ err }, '❌ Startup sync failed');
    });

    const scheduler = new CronScheduler(syncEngineInstance);
    scheduler.start();

    app.use('/sync', createSyncRouter(syncEngineInstance));
    logger.info('📦 [Mounted] Sync Service APIs at /sync');
  }

  // 3. Mount Leaderboard & Volunteer Service (if enabled)
  if (env.SERVICE_MODE === 'all' || env.SERVICE_MODE === 'leaderboard') {
    app.use('/', createAuthRouter());
    app.use('/events', createEventRouter());
    app.use('/', createNotificationRouter());
    app.use('/', createContactRouter());
    app.use('/admin', createAdminRouter(syncEngineInstance));
    logger.info('🏆 [Mounted] Leaderboard, Volunteer & Admin Monitoring APIs');
  }

  // 4. Global Unified Health Check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: `technika-${env.SERVICE_MODE}`,
      mongo: MongoDatabase.status,
      timestamp: new Date().toISOString(),
    });
  });

  app.use(errorHandler);

  const server = app.listen(env.PORT, env.HOST, () => {
    logger.info(`✨ Technika Backend (${env.SERVICE_MODE}) running on http://${env.HOST}:${env.PORT}`);
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    logger.info(`🛑 Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      await MongoDatabase.disconnect();
      logger.info('👋 Server shutdown complete.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err: any) => {
  logger.fatal({ err }, '💥 Fatal error during application boot');
  process.exit(1);
});
