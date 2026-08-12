import { Router } from 'express';
import { ContactController } from '../controllers/contact.controller';
import { authenticateAdmin } from '../../../../shared/middleware/auth.middleware';
import { validateRequest } from '../../../../shared/middleware/validate.middleware';
import { ContactSchema } from '../../../../shared/models/types';

export const createContactRouter = (): Router => {
  const router = Router();
  const controller = new ContactController();

  /**
   * GET /sos - Return emergency contacts list
   */
  router.get('/sos', controller.getContacts);

  /**
   * POST /sos - Admin manage/create contact
   */
  router.post('/sos', authenticateAdmin, validateRequest(ContactSchema), controller.createContact);

  return router;
};
