import { Request, Response, NextFunction } from 'express';
import { ContactRepository } from '../repositories/contact.repository';

export class ContactController {
  private contactRepo: ContactRepository;

  constructor() {
    this.contactRepo = new ContactRepository();
  }

  public getContacts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contacts = await this.contactRepo.getContacts();
      res.status(200).json({
        success: true,
        data: contacts,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  public createContact = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const contact = await this.contactRepo.createContact(req.body);
      res.status(201).json({
        success: true,
        data: contact,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
