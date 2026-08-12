import cron from 'node-cron';
import { IncrementalSyncEngine } from '../engine/incremental.engine';
import { env } from '../../../../shared/config/env.config';
import { logger } from '../../../../shared/logger/pino.logger';

export class CronScheduler {
  private syncEngine: IncrementalSyncEngine;
  private task: cron.ScheduledTask | null = null;

  constructor(syncEngine: IncrementalSyncEngine) {
    this.syncEngine = syncEngine;
  }

  public start(): void {
    if (!env.ENABLE_AUTO_CRON_SYNC) {
      logger.info('⏸️ Auto cron sync is disabled by environment configuration');
      return;
    }

    const intervalSec = env.CRON_SYNC_INTERVAL_SEC;
    // node-cron pattern: every X seconds -> `*/X * * * * *`
    const cronPattern = `*/${intervalSec} * * * * *`;

    logger.info({ intervalSec, pattern: cronPattern }, '⏰ Starting scheduled background sync worker...');

    this.task = cron.schedule(
      cronPattern,
      async () => {
        try {
          await this.syncEngine.runSync(false, 'SCHEDULED');
        } catch (error) {
          logger.error({ error }, '❌ Unhandled error in scheduled sync execution');
        }
      },
      {
        scheduled: true,
      }
    );
  }

  public stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('⏹️ Scheduled background sync worker stopped');
    }
  }
}
