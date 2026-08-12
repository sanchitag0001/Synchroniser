import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { VolunteerRepository } from '../repositories/volunteer.repository';
import { VolunteerLoginDto } from '../../../../shared/models/types';
import { UnauthorizedError, ForbiddenError } from '../../../../shared/errors/app.error';
import { env } from '../../../../shared/config/env.config';
import { logger } from '../../../../shared/logger/pino.logger';

export class AuthService {
  private volunteerRepo: VolunteerRepository;

  constructor() {
    this.volunteerRepo = new VolunteerRepository();
  }

  /**
   * Evaluates whether an event ID belongs to Campus Entry (Male & Female Entry Scanners)
   */
  private isCampusEntryEvent(eventId: string): boolean {
    const campusEntryIds = env.CAMPUS_ENTRY_EVENT_IDS.split(',').map((id) => id.trim().toUpperCase());
    return campusEntryIds.includes(eventId.trim().toUpperCase());
  }

  public async login(dto: VolunteerLoginDto): Promise<{ token: string; volunteer: any }> {
    const volunteer = await this.volunteerRepo.findByVolunteerId(dto.volunteerId);

    if (!volunteer) {
      logger.warn({ volunteerId: dto.volunteerId }, '❌ Login failed: Volunteer ID not found');
      throw new UnauthorizedError('Invalid Volunteer ID or password');
    }

    if (!volunteer.is_active) {
      throw new ForbiddenError('Volunteer account is deactivated. Please contact Technika organizers.');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, volunteer.password_hash);
    if (!isPasswordValid) {
      logger.warn({ volunteerId: dto.volunteerId }, '❌ Login failed: Incorrect password');
      throw new UnauthorizedError('Invalid Volunteer ID or password');
    }

    const assignedEventId = volunteer.assigned_event_id;
    const isCampusEntry = this.isCampusEntryEvent(assignedEventId);
    const maxAllowedDevices = isCampusEntry ? env.CAMPUS_ENTRY_MAX_DEVICES : env.STANDARD_EVENT_MAX_DEVICES;

    logger.info(
      {
        volunteerId: volunteer.volunteer_id,
        assignedEventId,
        isCampusEntry,
        maxAllowedDevices,
      },
      '🔐 Processing volunteer login and concurrency rules'
    );

    // Check currently active sessions for this event
    const activeSessions = await this.volunteerRepo.getActiveSessionsForEvent(assignedEventId);
    const otherActiveSessions = activeSessions.filter((s) => s.volunteer_id !== volunteer.volunteer_id);

    if (isCampusEntry) {
      // Campus Entry allows exactly 2 simultaneous active volunteer devices (Male & Female Scanners)
      if (otherActiveSessions.length >= maxAllowedDevices) {
        logger.warn(
          { assignedEventId, activeCount: otherActiveSessions.length, maxAllowedDevices },
          '⚠️ Campus Entry maximum active devices reached. Evicting oldest active session.'
        );
        await this.volunteerRepo.invalidateOldestSessionForEvent(assignedEventId, volunteer.volunteer_id);
      }
    } else {
      // Standard events allow strictly 1 active device at a time across the event
      if (otherActiveSessions.length >= maxAllowedDevices) {
        logger.warn(
          { assignedEventId, otherVolunteer: otherActiveSessions[0].volunteer_id },
          '⚠️ Standard event already has an active session. Invalidating previous volunteer session.'
        );
        for (const session of otherActiveSessions) {
          await this.volunteerRepo.clearSession(session.volunteer_id);
        }
      }
    }

    // Sign JWT with single-device claim
    const payload = {
      volunteerId: volunteer.volunteer_id,
      name: volunteer.name,
      assignedEventId: volunteer.assigned_event_id,
      deviceId: dto.deviceId,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRY as any,
    });

    // Invalidate this volunteer's prior session and register fresh device token
    await this.volunteerRepo.updateSession(volunteer.volunteer_id, token, dto.deviceId);

    logger.info(
      { volunteerId: volunteer.volunteer_id, deviceId: dto.deviceId, assignedEventId: volunteer.assigned_event_id },
      '🔑 Volunteer authenticated successfully'
    );

    return {
      token,
      volunteer: {
        volunteerId: volunteer.volunteer_id,
        name: volunteer.name,
        assignedEventId: volunteer.assigned_event_id,
        assignedEvent: volunteer.assignedEvent,
        maxEventDevices: maxAllowedDevices,
      },
    };
  }

  public async logout(volunteerId: string): Promise<void> {
    await this.volunteerRepo.clearSession(volunteerId);
    logger.info({ volunteerId }, '🚪 Volunteer logged out');
  }
}
