import { Router } from 'express';
import { EventController } from '../controllers/event.controller';
import { AttendanceController } from '../controllers/attendance.controller';
import { WinnerController } from '../controllers/winner.controller';
import { authenticateVolunteer } from '../../../../shared/middleware/auth.middleware';
import { validateRequest } from '../../../../shared/middleware/validate.middleware';
import { WinnerSubmissionSchema } from '../../../../shared/models/types';

export const createEventRouter = (): Router => {
  const router = Router();
  const eventCtrl = new EventController();
  const attendanceCtrl = new AttendanceController();
  const winnerCtrl = new WinnerController();

  /**
   * GET /events - Return all events
   */
  router.get('/', eventCtrl.getEvents);

  /**
   * GET /events/:id - Return event details
   */
  router.get('/:id', eventCtrl.getEventById);

  /**
   * GET /events/:id/participants - Return participants for the event (scoped cache for volunteer)
   */
  router.get('/:id/participants', authenticateVolunteer, eventCtrl.getParticipantsForEvent);

  /**
   * GET /events/:id/attendance - Return attendance list for event
   */
  router.get('/:id/attendance', authenticateVolunteer, attendanceCtrl.getAttendance);

  /**
   * POST /events/:id/attendance - Mark attendance (duplicate safe, instant return)
   */
  router.post('/:id/attendance', authenticateVolunteer, attendanceCtrl.markAttendance);

  /**
   * POST /events/:id/winners - Declare winners (validates attendance)
   */
  router.post('/:id/winners', authenticateVolunteer, validateRequest(WinnerSubmissionSchema), winnerCtrl.declareWinner);

  /**
   * GET /events/:id/winners - Return winners list for event
   */
  router.get('/:id/winners', winnerCtrl.getWinners);

  return router;
};
