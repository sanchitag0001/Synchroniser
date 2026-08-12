import { Request, Response, NextFunction } from 'express';
import { AdminService } from '../services/admin.service';
import { IncrementalSyncEngine } from '../../../sync-service/src/engine/incremental.engine';

export class AdminController {
  private adminService: AdminService;
  private syncEngine?: IncrementalSyncEngine;

  constructor(syncEngine?: IncrementalSyncEngine) {
    this.syncEngine = syncEngine;
    this.adminService = new AdminService(syncEngine);
  }

  public getMonitoring = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const metrics = await this.adminService.getMonitoringDashboard();
      res.status(200).json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  public forceSync = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.syncEngine) {
        res.status(400).json({ success: false, message: 'Sync engine is not attached in this process mode' });
        return;
      }
      const forceFull = req.body?.full === true;
      const result = await this.syncEngine.runSync(forceFull, 'MANUAL');
      res.status(result.status === 'COMPLETED' ? 200 : 500).json({
        success: result.status === 'COMPLETED',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  public updateLifecycle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const { lifecycleState } = req.body;
      const updated = await this.adminService.setEventLifecycle(eventId, lifecycleState);
      res.status(200).json({
        success: true,
        message: `Event "${eventId}" lifecycle state updated to "${lifecycleState}"`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  public lockEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const updated = await this.adminService.setEventLifecycle(eventId, 'LOCKED');
      res.status(200).json({
        success: true,
        message: `Event "${eventId}" has been LOCKED (read-only)`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  public unlockEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const updated = await this.adminService.setEventLifecycle(eventId, 'SCANNING_OPEN');
      res.status(200).json({
        success: true,
        message: `Event "${eventId}" has been UNLOCKED to SCANNING_OPEN`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  public forceLogout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const volunteerId = req.params.id;
      await this.adminService.forceLogoutVolunteer(volunteerId);
      res.status(200).json({
        success: true,
        message: `Volunteer "${volunteerId}" session has been invalidated`,
      });
    } catch (error) {
      next(error);
    }
  };

  public reassignVolunteer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const volunteerId = req.params.id;
      const { assignedEventId } = req.body;
      const updated = await this.adminService.reassignVolunteer(volunteerId, assignedEventId);
      res.status(200).json({
        success: true,
        message: `Volunteer "${volunteerId}" reassigned to event "${assignedEventId}" (Session cleared for fresh login)`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  public getActiveSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const sessions = await this.adminService.getActiveSessions();
      res.status(200).json({
        success: true,
        data: sessions,
        count: sessions.length,
      });
    } catch (error) {
      next(error);
    }
  };

  public exportAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const csv = await this.adminService.exportAttendanceCsv();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=attendance_export_${Date.now()}.csv`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  };

  public exportWinners = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const csv = await this.adminService.exportWinnersCsv();
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=winners_export_${Date.now()}.csv`);
      res.status(200).send(csv);
    } catch (error) {
      next(error);
    }
  };
}
