import { Request, Response, NextFunction } from 'express';
import { IncrementalSyncEngine } from '../engine/incremental.engine';
import { SyncLogRepository } from '../repositories/sync_log.repository';

export class SyncController {
  private syncEngine: IncrementalSyncEngine;
  private syncLogRepo: SyncLogRepository;

  constructor(syncEngine: IncrementalSyncEngine) {
    this.syncEngine = syncEngine;
    this.syncLogRepo = new SyncLogRepository();
  }

  public runSync = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const forceFull = req.body?.full === true || req.query?.full === 'true';
      const result = await this.syncEngine.runSync(forceFull, 'MANUAL');

      res.status(result.status === 'COMPLETED' ? 200 : 500).json({
        success: result.status === 'COMPLETED',
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  public getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const engineStatus = this.syncEngine.getStatus();
      const recentLogs = await this.syncLogRepo.getLatestLogs(5);

      res.status(200).json({
        success: true,
        data: {
          service: 'Technika Sync Service',
          engine: engineStatus,
          recentSyncLogs: recentLogs,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
