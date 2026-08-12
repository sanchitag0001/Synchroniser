import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { authenticateAdmin } from '../../../../shared/middleware/auth.middleware';
import { validateRequest } from '../../../../shared/middleware/validate.middleware';
import { EventLifecycleSchema, VolunteerReassignSchema } from '../../../../shared/models/types';
import { IncrementalSyncEngine } from '../../../sync-service/src/engine/incremental.engine';

export const createAdminRouter = (syncEngine?: IncrementalSyncEngine): Router => {
  const router = Router();
  const controller = new AdminController(syncEngine);

  // All Admin routes require X-Admin-Api-Key or Admin Bearer Token
  router.use(authenticateAdmin);

  /**
   * GET /admin/monitor - System monitoring dashboard metrics
   */
  router.get('/monitor', controller.getMonitoring);

  /**
   * POST /admin/sync/force - Force immediate sync MongoDB -> Supabase
   */
  router.post('/sync/force', controller.forceSync);

  /**
   * PATCH /admin/events/:id/lifecycle - Transition event lifecycle state
   */
  router.patch('/events/:id/lifecycle', validateRequest(EventLifecycleSchema), controller.updateLifecycle);

  /**
   * PATCH /admin/events/:id/lock - Lock event (read-only)
   */
  router.patch('/events/:id/lock', controller.lockEvent);

  /**
   * PATCH /admin/events/:id/unlock - Unlock event (resume scanning)
   */
  router.patch('/events/:id/unlock', controller.unlockEvent);

  /**
   * GET /admin/volunteers/active - View connected volunteer devices & sessions
   */
  router.get('/volunteers/active', controller.getActiveSessions);

  /**
   * POST /admin/volunteers/:id/force-logout - Invalidate a volunteer's session
   */
  router.post('/volunteers/:id/force-logout', controller.forceLogout);

  /**
   * PATCH /admin/volunteers/:id/reassign - Reassign volunteer to another event
   */
  router.patch('/volunteers/:id/reassign', validateRequest(VolunteerReassignSchema), controller.reassignVolunteer);

  /**
   * GET /admin/export/attendance.csv - Export attendance CSV
   */
  router.get('/export/attendance.csv', controller.exportAttendance);

  /**
   * GET /admin/export/winners.csv - Export winners CSV
   */
  router.get('/export/winners.csv', controller.exportWinners);

  return router;
};
