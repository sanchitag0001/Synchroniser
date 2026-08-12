import { Response, NextFunction } from 'express';
import { AttendanceService } from '../services/attendance.service';
import { AuthenticatedRequest } from '../../../../shared/middleware/auth.middleware';

export class AttendanceController {
  private attendanceService: AttendanceService;

  constructor() {
    this.attendanceService = new AttendanceService();
  }

  public markAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const { registrationId, teamId, deviceTimestamp, offlineSyncId, scanMode, scanTime } = req.body;

      const result = await this.attendanceService.markAttendance({
        eventId,
        registrationId,
        teamId,
        scannedByVolunteerId: req.volunteer!.volunteerId,
        volunteerAssignedEventId: req.volunteer!.assignedEventId,
        deviceId: req.volunteer?.deviceId || req.body?.deviceId,
        scanMode: scanMode || 'ONLINE',
        scanTime,
        deviceTimestamp,
        offlineSyncId,
      });

      res.status(200).json({
        success: true,
        status: result.status, // "Attendance Marked" or "Already Present"
        present: result.present,
        data: result.record,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  public getAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const eventId = req.params.id;
      const records = await this.attendanceService.getAttendanceForEvent(eventId);

      res.status(200).json({
        success: true,
        data: records,
        count: records.length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}
