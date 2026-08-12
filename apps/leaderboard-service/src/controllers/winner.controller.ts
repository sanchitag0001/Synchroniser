import { Response, NextFunction } from 'express';
import { WinnerService } from '../services/winner.service';
import { AuthenticatedRequest } from '../../../../shared/middleware/auth.middleware';

export class WinnerController {
  private winnerService: WinnerService;

  constructor() {
    this.winnerService = new WinnerService();
  }

  public declareWinner = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const result = await this.winnerService.declareWinner(
        eventId,
        req.body,
        req.volunteer!.volunteerId,
        req.volunteer!.assignedEventId
      );

      res.status(200).json({
        success: true,
        message: 'Winner successfully recorded for event',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  public getWinners = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const winners = await this.winnerService.getWinnersForEvent(eventId);

      res.status(200).json({
        success: true,
        data: winners,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
