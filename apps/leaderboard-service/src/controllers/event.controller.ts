import { Request, Response, NextFunction } from 'express';
import { EventRepository } from '../repositories/event.repository';
import { NotFoundError } from '../../../../shared/errors/app.error';

export class EventController {
  private eventRepo: EventRepository;

  constructor() {
    this.eventRepo = new EventRepository();
  }

  public getEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const events = await this.eventRepo.findAll();
      res.status(200).json({
        success: true,
        data: events,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  public getEventById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = await this.eventRepo.findByEventId(req.params.id);
      if (!event) {
        throw new NotFoundError(`Event with ID "${req.params.id}" not found`);
      }
      res.status(200).json({
        success: true,
        data: event,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  public getParticipantsForEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const presentOnly = req.query.presentOnly === 'true' || req.query.status === 'present';
      const participants = await this.eventRepo.getParticipantsForEvent(req.params.id, presentOnly);
      res.status(200).json({
        success: true,
        data: participants,
        count: participants.length,
        filter: { presentOnly },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
