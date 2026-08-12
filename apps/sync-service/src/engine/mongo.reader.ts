import mongoose from 'mongoose';
import {
  IParticipantRecord,
  IEventRecord,
  ITeamRecord,
  ITeamMemberRecord,
  IRegistrationRecord,
  EventType,
  EventLifecycleState,
} from '../../../../shared/models/types';
import { logger } from '../../../../shared/logger/pino.logger';
import { env } from '../../../../shared/config/env.config';

export class MongoReader {
  private isSystemEvent(eventId: string): boolean {
    const campusEntryIds = env.CAMPUS_ENTRY_EVENT_IDS.split(',').map((id) => id.trim().toUpperCase());
    return campusEntryIds.includes(eventId.trim().toUpperCase()) || eventId.toUpperCase().includes('ENTRY');
  }

  /**
   * Fetch users from MongoDB Atlas and map to Supabase Participant format
   * Sensitive fields (passwordHash, paymentUTR, paymentScreenshotUrl) are NEVER included.
   */
  public async fetchParticipants(since?: Date): Promise<IParticipantRecord[]> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database instance is not connected');

    const collection = db.collection('users');
    const query = since ? { $or: [{ updatedAt: { $gte: since } }, { createdAt: { $gte: since } }] } : {};

    const cursor = collection.find(query, {
      projection: {
        registrationId: 1,
        name: 1,
        institution: 1,
        email: 1,
        whatsapp: 1,
        gender: 1,
        age: 1,
        course: 1,
        semester: 1,
        isRegistrationFrozen: 1,
        updatedAt: 1,
        createdAt: 1,
      },
    });

    const docs = await cursor.toArray();
    logger.debug({ count: docs.length, since }, '📥 Fetched participants from MongoDB');

    return docs
      .filter((d) => d.registrationId && d.name)
      .map((d) => ({
        registration_id: d.registrationId.trim().toUpperCase(),
        name: d.name.trim(),
        college: (d.institution || 'Unknown Institution').trim(),
        email: (d.email || '').trim().toLowerCase(),
        phone: (d.whatsapp || '').trim(),
        gender: d.gender || 'Other',
        age: Number(d.age) || 18,
        course: d.course || null,
        semester: d.semester || null,
        is_verified: true,
        is_registration_frozen: Boolean(d.isRegistrationFrozen),
        updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
        created_at: d.createdAt ? new Date(d.createdAt).toISOString() : new Date().toISOString(),
      }));
  }

  /**
   * Fetch events from MongoDB Atlas with System vs Competition distinction and Lifecycle state
   */
  public async fetchEvents(since?: Date): Promise<IEventRecord[]> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database instance is not connected');

    const collection = db.collection('events');
    const query = since ? { $or: [{ updatedAt: { $gte: since } }, { createdAt: { $gte: since } }] } : {};

    const cursor = collection.find(query);
    const docs = await cursor.toArray();
    logger.debug({ count: docs.length, since }, '📥 Fetched events from MongoDB');

    return docs
      .filter((d) => d.eventId && d.name)
      .map((d) => {
        const isSystem = this.isSystemEvent(d.eventId);
        const eventType: EventType = isSystem ? 'SYSTEM' : (d.eventType as EventType) || 'COMPETITION';
        const maxActiveDevices = isSystem
          ? env.CAMPUS_ENTRY_MAX_DEVICES
          : Number(d.maxActiveDevices) || env.STANDARD_EVENT_MAX_DEVICES;
        const lifecycleState: EventLifecycleState = (d.lifecycleState as EventLifecycleState) || 'SCANNING_OPEN';

        return {
          event_id: d.eventId.trim(),
          name: d.name.trim(),
          category: d.category || (isSystem ? 'Campus Operations' : 'General'),
          event_type: eventType,
          lifecycle_state: lifecycleState,
          max_active_devices: maxActiveDevices,
          description: d.description || '',
          venue: d.venue || 'Campus Main Venue',
          day: d.day || 'Day 1',
          start_time: d.startTime || '10:00 AM',
          end_time: d.endTime || '05:00 PM',
          capacity: Number(d.capacity) || 100,
          individual_allowed: Boolean(d.individualAllowed ?? true),
          team_allowed: Boolean(d.teamAllowed ?? false),
          min_members: Number(d.minMembers) || 1,
          max_members: Number(d.maxMembers) || 1,
          points_first: isSystem ? 0 : Number(d.pointsFirst) || 10,
          points_second: isSystem ? 0 : Number(d.pointsSecond) || 7,
          points_third: isSystem ? 0 : Number(d.pointsThird) || 5,
          is_active: Boolean(d.isActive ?? true),
          display_order: Number(d.displayOrder) || 0,
          updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
        };
      });
  }

  /**
   * Fetch teams from MongoDB Atlas
   */
  public async fetchTeams(since?: Date): Promise<ITeamRecord[]> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database instance is not connected');

    const collection = db.collection('teams');
    const query = since ? { $or: [{ updatedAt: { $gte: since } }, { createdAt: { $gte: since } }] } : {};

    const cursor = collection.find(query);
    const docs = await cursor.toArray();
    logger.debug({ count: docs.length, since }, '📥 Fetched teams from MongoDB');

    return docs
      .filter((d) => d.teamId && d.eventId && d.leaderId)
      .map((d) => ({
        team_id: d.teamId.trim(),
        team_name: d.teamName || `Team ${d.teamId}`,
        event_id: d.eventId.trim(),
        leader_id: d.leaderId.trim().toUpperCase(),
        status: d.status || 'forming',
        member_count: Number(d.memberCount) || 1,
        updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
      }));
  }

  /**
   * Fetch team members from MongoDB Atlas
   */
  public async fetchTeamMembers(since?: Date): Promise<ITeamMemberRecord[]> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database instance is not connected');

    const collection = db.collection('teammembers');
    const query = since ? { $or: [{ updatedAt: { $gte: since } }, { createdAt: { $gte: since } }] } : {};

    const cursor = collection.find(query);
    const docs = await cursor.toArray();
    logger.debug({ count: docs.length, since }, '📥 Fetched team members from MongoDB');

    return docs
      .filter((d) => d.teamId && d.userId)
      .map((d) => ({
        team_id: d.teamId.trim(),
        user_id: d.userId.trim().toUpperCase(),
        role: d.role || 'Member',
        joined_at: d.joinedAt ? new Date(d.joinedAt).toISOString() : new Date().toISOString(),
        updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
      }));
  }

  /**
   * Fetch registrations from MongoDB Atlas
   */
  public async fetchRegistrations(since?: Date): Promise<IRegistrationRecord[]> {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database instance is not connected');

    const collection = db.collection('registrations');
    const query = since ? { $or: [{ updatedAt: { $gte: since } }, { createdAt: { $gte: since } }] } : {};

    const cursor = collection.find(query);
    const docs = await cursor.toArray();
    logger.debug({ count: docs.length, since }, '📥 Fetched registrations from MongoDB');

    return docs
      .filter((d) => d.registrationId && d.eventId)
      .map((d) => ({
        registration_id: d.registrationId.trim().toUpperCase(),
        event_id: d.eventId.trim(),
        team_id: d.teamId ? d.teamId.trim() : null,
        registration_type: d.registrationType || 'INDIVIDUAL',
        status: d.status || 'CONFIRMED',
        registered_at: d.registeredAt ? new Date(d.registeredAt).toISOString() : new Date().toISOString(),
        updated_at: d.updatedAt ? new Date(d.updatedAt).toISOString() : new Date().toISOString(),
      }));
  }
}
