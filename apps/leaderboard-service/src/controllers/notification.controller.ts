import { Response, NextFunction } from 'express';
import { NotificationRepository } from '../repositories/notification.repository';
import { AuthenticatedRequest } from '../../../../shared/middleware/auth.middleware';

export class NotificationController {
  private notificationRepo: NotificationRepository;

  constructor() {
    this.notificationRepo = new NotificationRepository();
  }

  public getNotifications = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const targetEventId = req.volunteer?.assignedEventId || (req.query.eventId as string);
      const notifications = await this.notificationRepo.getActiveNotifications(targetEventId);

      res.status(200).json({
        success: true,
        data: notifications,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  public publishNotification = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.notificationRepo.createNotification(req.body);
      res.status(201).json({
        success: true,
        message: 'Notification published successfully',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
