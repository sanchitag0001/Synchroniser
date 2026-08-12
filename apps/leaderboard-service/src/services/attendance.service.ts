import { AttendanceRepository } from '../repositories/attendance.repository';
import { EventRepository } from '../repositories/event.repository';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/logger/pino.logger';

export class AttendanceService {
  private attendanceRepo: AttendanceRepository;
  private eventRepo: EventRepository;

  constructor() {
    this.attendanceRepo = new AttendanceRepository();
    this.eventRepo = new EventRepository();
  }

  public async markAttendance(params: {
    eventId: string;
    registrationId: string;
    teamId?: string | null;
    scannedByVolunteerId: string;
    volunteerAssignedEventId: string;
    deviceId?: string | null;
    scanMode?: 'ONLINE' | 'OFFLINE';
    scanTime?: string;
    deviceTimestamp?: string;
    offlineSyncId?: string;
  }): Promise<{ status: 'Attendance Marked' | 'Already Present'; present: boolean; record: any }> {
    // 1. Volunteer Event Scope Validation
    if (params.eventId !== params.volunteerAssignedEventId) {
      logger.warn(
        {
          volunteerId: params.scannedByVolunteerId,
          assigned: params.volunteerAssignedEventId,
          requested: params.eventId,
        },
        '❌ Volunteer attempted to scan for unassigned event'
      );
      throw new BadRequestError(
        `Unauthorized scan: You are only authorized to scan for event "${params.volunteerAssignedEventId}".`
      );
    }

    // 2. Event Lifecycle State Enforcement
    const event = await this.eventRepo.findByEventId(params.eventId);
    if (!event) {
      throw new NotFoundError(`Event "${params.eventId}" does not exist.`);
    }

    if (event.lifecycle_state === 'LOCKED') {
      throw new ForbiddenError(`Event "${params.eventId}" is LOCKED. Attendance cannot be modified.`);
    }

    if (event.lifecycle_state === 'UPCOMING' || event.lifecycle_state === 'REGISTRATION_OPEN') {
      throw new BadRequestError(
        `Scanning is not active yet for "${params.eventId}". Current state: ${event.lifecycle_state}.`
      );
    }

    if (event.lifecycle_state === 'SCANNING_CLOSED' || event.lifecycle_state === 'COMPLETED') {
      throw new BadRequestError(
        `Scanning is closed for "${params.eventId}". Current state: ${event.lifecycle_state}.`
      );
    }

    // 3. Generate unique sync ID if omitted
    const syncId = params.offlineSyncId || `${params.scannedByVolunteerId}-${params.registrationId}-${Date.now()}`;

    // 4. Mark attendance with audit trail
    const result = await this.attendanceRepo.markAttendance({
      eventId: params.eventId,
      registrationId: params.registrationId,
      teamId: params.teamId,
      scannedBy: params.scannedByVolunteerId,
      deviceId: params.deviceId,
      scanMode: params.scanMode || 'ONLINE',
      scanTime: params.scanTime,
      deviceTimestamp: params.deviceTimestamp,
      offlineSyncId: syncId,
    });

    if (result.isNew) {
      logger.info(
        {
          eventId: params.eventId,
          regId: params.registrationId,
          volunteer: params.scannedByVolunteerId,
          deviceId: params.deviceId,
          scanMode: params.scanMode,
        },
        '✅ Attendance Marked (Audit Trail Logged)'
      );
      return {
        status: 'Attendance Marked',
        present: true,
        record: result.record,
      };
    } else {
      logger.info(
        { eventId: params.eventId, regId: params.registrationId },
        'ℹ️ Already Present'
      );
      return {
        status: 'Already Present',
        present: true,
        record: result.record,
      };
    }
  }

  public async getAttendanceForEvent(eventId: string): Promise<any[]> {
    return this.attendanceRepo.getAttendanceForEvent(eventId);
  }
}
