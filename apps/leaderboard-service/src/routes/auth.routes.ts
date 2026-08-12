import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateVolunteer } from '../../../../shared/middleware/auth.middleware';
import { validateRequest } from '../../../../shared/middleware/validate.middleware';
import { VolunteerLoginSchema } from '../../../../shared/models/types';

export const createAuthRouter = (): Router => {
  const router = Router();
  const controller = new AuthController();

  /**
   * POST /login - Volunteer Login with single device session tracking
   */
  router.post('/login', validateRequest(VolunteerLoginSchema), controller.login);

  /**
   * GET /assignment - Returns volunteer's assigned event details
   */
  router.get('/assignment', authenticateVolunteer, controller.getAssignment);

  /**
   * POST /logout - Revokes active session
   */
  router.post('/logout', authenticateVolunteer, controller.logout);

  return router;
};
