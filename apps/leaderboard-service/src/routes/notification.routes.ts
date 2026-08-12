import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';
import { authenticateVolunteer, authenticateAdmin } from '../../../../shared/middleware/auth.middleware';
import { validateRequest } from '../../../../shared/middleware/validate.middleware';
import { NotificationPublishSchema } from '../../../../shared/models/types';

export const createNotificationRouter = (): Router => {
  const router = Router();
  const controller = new NotificationController();

  /**
   * GET /notifications - Return active notifications for volunteer
   */
  router.get('/notifications', authenticateVolunteer, controller.getNotifications);

  /**
   * POST /notification - Admin broadcast notification
   */
  router.post('/notification', authenticateAdmin, validateRequest(NotificationPublishSchema), controller.publishNotification);

  return router;
};
