import { Router } from 'express';
import { SyncController } from '../controllers/sync.controller';
import { IncrementalSyncEngine } from '../engine/incremental.engine';
import { authenticateAdmin } from '../../../../shared/middleware/auth.middleware';

export const createSyncRouter = (syncEngine: IncrementalSyncEngine): Router => {
  const router = Router();
  const controller = new SyncController(syncEngine);

  /**
   * POST /sync/run - Manually trigger full or incremental sync
   */
  router.post('/run', authenticateAdmin, controller.runSync);

  /**
   * GET /sync/status - Telemetry, engine state, and recent sync audit history
   */
  router.get('/status', controller.getStatus);

  return router;
};
