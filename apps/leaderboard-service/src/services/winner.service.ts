import { WinnerRepository } from '../repositories/winner.repository';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { EventRepository } from '../repositories/event.repository';
import { WinnerSubmissionDto } from '../../../../shared/models/types';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../../../shared/errors/app.error';
import { logger } from '../../../../shared/logger/pino.logger';

export class WinnerService {
  private winnerRepo: WinnerRepository;
  private attendanceRepo: AttendanceRepository;
  private eventRepo: EventRepository;

  constructor() {
    this.winnerRepo = new WinnerRepository();
    this.attendanceRepo = new AttendanceRepository();
    this.eventRepo = new EventRepository();
  }

  public async declareWinner(
    eventId: string,
    dto: WinnerSubmissionDto,
    volunteerId: string,
    volunteerAssignedEventId: string
  ): Promise<any> {
    // 1. Volunteer Scope Check
    if (eventId !== volunteerAssignedEventId) {
      throw new BadRequestError(
        `Unauthorized: You can only declare winners for your assigned event "${volunteerAssignedEventId}".`
      );
    }

    // 2. Event Existence Check
    const event = await this.eventRepo.findByEventId(eventId);
    if (!event) {
      throw new NotFoundError(`Event "${eventId}" not found.`);
    }

    // 3. System Event Guard (System events like Campus Entry do NOT have winners)
    if (event.event_type === 'SYSTEM') {
      logger.warn({ eventId, volunteerId }, '❌ Winner declaration rejected on SYSTEM event');
      throw new BadRequestError(
        `Invalid Action: Event "${eventId}" is a SYSTEM event (Attendance Only) and does not support winner declarations.`
      );
    }

    // 4. Event Lifecycle State Check
    if (event.lifecycle_state === 'LOCKED') {
      throw new ForbiddenError(`Event "${eventId}" is LOCKED. Winner declarations are read-only.`);
    }

    if (
      event.lifecycle_state === 'UPCOMING' ||
      event.lifecycle_state === 'REGISTRATION_OPEN' ||
      event.lifecycle_state === 'SCANNING_OPEN'
    ) {
      throw new BadRequestError(
        `Winner declaration is not yet open for "${eventId}". Current state: ${event.lifecycle_state}. It must transition to "WINNER_DECLARATION_OPEN".`
      );
    }

    // 5. Attendance Validation ("Only PRESENT participants can become winners")
    if (dto.registrationId) {
      const isPresent = await this.attendanceRepo.isParticipantPresent(eventId, dto.registrationId);
      if (!isPresent) {
        logger.warn(
          { eventId, regId: dto.registrationId, volunteer: volunteerId },
          '❌ Winner declaration rejected: Participant is absent'
        );
        throw new BadRequestError(
          `Validation Failed: Participant "${dto.registrationId}" is marked ABSENT. Only participants with scanned attendance can be declared winners.`
        );
      }
    }

    // 6. Calculate Points Awarded based on Event Definition
    let pointsAwarded = event.points_first || 10;
    if (dto.position === 2) {
      pointsAwarded = event.points_second || 7;
    } else if (dto.position === 3) {
      pointsAwarded = event.points_third || 5;
    }

    // 7. Persist Winner with Audit Trail
    const winnerRecord = await this.winnerRepo.setWinner({
      eventId,
      position: dto.position,
      registrationId: dto.registrationId,
      teamId: dto.teamId,
      pointsAwarded,
      enteredBy: volunteerId,
      remarks: dto.remarks,
    });

    logger.info(
      {
        eventId,
        position: dto.position,
        regId: dto.registrationId,
        teamId: dto.teamId,
        points: pointsAwarded,
        declaredBy: volunteerId,
      },
      '🏆 Winner successfully declared and audit trail recorded'
    );

    return winnerRecord;
  }

  public async getWinnersForEvent(eventId: string): Promise<any[]> {
    return this.winnerRepo.getWinnersForEvent(eventId);
  }
}
