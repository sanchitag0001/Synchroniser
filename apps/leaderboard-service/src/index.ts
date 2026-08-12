import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from '../../../shared/config/env.config';
import { logger } from '../../../shared/logger/pino.logger';
import { SupabaseDatabase } from '../../../shared/database/supabase.client';
import { createAuthRouter } from './routes/auth.routes';
import { createEventRouter } from './routes/event.routes';
import { createNotificationRouter } from './routes/notification.routes';
import { createContactRouter } from './routes/contact.routes';
import { createAdminRouter } from './routes/admin.routes';
import { errorHandler } from '../../../shared/middleware/error.middleware';
import { apiRateLimiter } from '../../../shared/middleware/rate_limit.middleware';

export async function bootstrapLeaderboardService(): Promise<express.Application> {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN }));
  app.use(express.json({ limit: '10mb' }));
  app.use(apiRateLimiter);

  // Health check Supabase
  try {
    await SupabaseDatabase.ping();
  } catch (err) {
    logger.error({ err }, '⚠️ Supabase connection issue on startup');
  }

  // Mount APIs
  app.use('/', createAuthRouter());
  app.use('/events', createEventRouter());
  app.use('/', createNotificationRouter());
  app.use('/', createContactRouter());
  app.use('/admin', createAdminRouter());

  // Health check
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'healthy',
      service: 'leaderboard-service',
      timestamp: new Date().toISOString(),
    });
  });

  app.use(errorHandler);
  return app;
}

// Standalone execution if launched directly
if (require.main === module) {
  bootstrapLeaderboardService().then((app) => {
    app.listen(env.PORT, env.HOST, () => {
      logger.info(`🏆 Technika Leaderboard & Volunteer Service running on http://${env.HOST}:${env.PORT}`);
    });
  });
}
