import { SupabaseDatabase } from '../../../../shared/database/supabase.client';
import { MongoDatabase } from '../../../../shared/database/mongo.connection';
import { AttendanceRepository } from '../repositories/attendance.repository';
import { WinnerRepository } from '../repositories/winner.repository';
import { VolunteerRepository } from '../repositories/volunteer.repository';
import { SyncLogRepository } from '../../../sync-service/src/repositories/sync_log.repository';
import { IncrementalSyncEngine } from '../../../sync-service/src/engine/incremental.engine';
import { EventLifecycleState } from '../../../../shared/models/types';
import { NotFoundError } from '../../../../shared/errors/app.error';

export class AdminService {
  private attendanceRepo: AttendanceRepository;
  private winnerRepo: WinnerRepository;
  private volunteerRepo: VolunteerRepository;
  private syncLogRepo: SyncLogRepository;
  private syncEngine?: IncrementalSyncEngine;

  constructor(syncEngine?: IncrementalSyncEngine) {
    this.attendanceRepo = new AttendanceRepository();
    this.winnerRepo = new WinnerRepository();
    this.volunteerRepo = new VolunteerRepository();
    this.syncLogRepo = new SyncLogRepository();
    this.syncEngine = syncEngine;
  }

  public async getMonitoringDashboard(): Promise<any> {
    const supabaseHealthy = await SupabaseDatabase.ping();
    const lastSyncDate = await this.syncLogRepo.getLastSuccessfulCheckpoint();
    const totalAttendance = await this.attendanceRepo.getTotalAttendanceCount();
    const eventAttendanceCounts = await this.attendanceRepo.getAttendanceCountPerEvent();
    const totalWinners = await this.winnerRepo.getTotalWinnersCount();
    const recentSyncLogs = await this.syncLogRepo.getLatestLogs(5);

    // Fetch active volunteers and devices
    const { data: onlineVolunteers } = await SupabaseDatabase.client
      .from('volunteers')
      .select('volunteer_id, name, assigned_event_id, active_device_id, last_login_at')
      .not('active_session_token', 'is', null);

    // Fetch notification count
    const { count: notificationCount } = await SupabaseDatabase.client
      .from('notifications')
      .select('*', { count: 'exact', head: true });

    const uptimeSeconds = process.uptime();
    const memoryUsageMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

    return {
      systemHealth: {
        status: MongoDatabase.status && supabaseHealthy ? 'OPTIMAL' : 'DEGRADED',
        uptimeSeconds: Math.floor(uptimeSeconds),
        memoryUsageMb: `${memoryUsageMb} MB`,
        timestamp: new Date().toISOString(),
      },
      databases: {
        mongoAtlas: {
          connected: MongoDatabase.status,
          role: 'Master Source of Truth (Registration Data)',
        },
        supabasePostgres: {
          connected: supabaseHealthy,
          role: 'Operational Store (Attendance & Winners)',
        },
      },
      syncEngine: {
        lastSuccessfulSync: lastSyncDate ? lastSyncDate.toISOString() : 'None',
        engineState: this.syncEngine ? this.syncEngine.getStatus() : { isSyncInProgress: false },
        recentLogs: recentSyncLogs,
      },
      liveOperations: {
        onlineVolunteersCount: (onlineVolunteers || []).length,
        onlineVolunteers: onlineVolunteers || [],
        totalAttendanceToday: totalAttendance,
        attendancePerEvent: eventAttendanceCounts,
        winnersDeclaredTotal: totalWinners,
        broadcastNotificationsCount: notificationCount || 0,
      },
    };
  }

  public async setEventLifecycle(eventId: string, state: EventLifecycleState): Promise<any> {
    const { data, error } = await SupabaseDatabase.client
      .from('events')
      .update({
        lifecycle_state: state,
        updated_at: new Date().toISOString(),
      })
      .eq('event_id', eventId)
      .select('*')
      .single();

    if (error || !data) {
      throw new NotFoundError(`Event "${eventId}" not found.`);
    }
    return data;
  }

  public async forceLogoutVolunteer(volunteerId: string): Promise<void> {
    await this.volunteerRepo.clearSession(volunteerId);
  }

  public async reassignVolunteer(volunteerId: string, assignedEventId: string): Promise<any> {
    const { data, error } = await SupabaseDatabase.client
      .from('volunteers')
      .update({
        assigned_event_id: assignedEventId,
        active_session_token: null, // Forces re-login to download fresh scoped event cache
        active_device_id: null,
      })
      .eq('volunteer_id', volunteerId)
      .select('*')
      .single();

    if (error || !data) {
      throw new NotFoundError(`Volunteer "${volunteerId}" not found.`);
    }
    return data;
  }

  public async getActiveSessions(): Promise<any[]> {
    const { data, error } = await SupabaseDatabase.client
      .from('volunteers')
      .select('volunteer_id, name, assigned_event_id, active_device_id, last_login_at, is_active')
      .not('active_session_token', 'is', null);

    if (error) throw error;
    return data || [];
  }

  public async exportAttendanceCsv(): Promise<string> {
    const { data, error } = await SupabaseDatabase.client
      .from('attendance')
      .select(`
        registration_id,
        event_id,
        team_id,
        scanned_by,
        device_id,
        scan_mode,
        scan_time,
        sync_time,
        present,
        participant:participants (
          name,
          college,
          email,
          phone
        )
      `)
      .order('scan_time', { ascending: false });

    if (error) throw error;

    const rows = ['Registration ID,Name,College,Email,Phone,Event ID,Team ID,Scanned By,Device ID,Scan Mode,Scan Time,Sync Time,Present'];
    for (const d of (data || [])) {
      const p = (d.participant as any) || {};
      rows.push(
        [
          `"${d.registration_id}"`,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.college || '').replace(/"/g, '""')}"`,
          `"${p.email || ''}"`,
          `"${p.phone || ''}"`,
          `"${d.event_id}"`,
          `"${d.team_id || ''}"`,
          `"${d.scanned_by}"`,
          `"${d.device_id || ''}"`,
          `"${d.scan_mode || 'ONLINE'}"`,
          `"${d.scan_time}"`,
          `"${d.sync_time}"`,
          `"${d.present}"`,
        ].join(',')
      );
    }
    return rows.join('\n');
  }

  public async exportWinnersCsv(): Promise<string> {
    const winners = await this.winnerRepo.getAllWinnersForExport();
    const rows = ['Event ID,Event Name,Position,Points,Registration ID,Participant Name,College,Team ID,Declared By,Declared At,Last Modified At,Remarks'];

    for (const w of winners) {
      const ev = (w.event as any) || {};
      const p = (w.participant as any) || {};
      rows.push(
        [
          `"${w.event_id}"`,
          `"${(ev.name || '').replace(/"/g, '""')}"`,
          `"${w.position}"`,
          `"${w.points_awarded}"`,
          `"${w.registration_id || ''}"`,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.college || '').replace(/"/g, '""')}"`,
          `"${w.team_id || ''}"`,
          `"${w.declared_by}"`,
          `"${w.declared_at}"`,
          `"${w.last_modified_at || ''}"`,
          `"${(w.remarks || '').replace(/"/g, '""')}"`,
        ].join(',')
      );
    }
    return rows.join('\n');
  }
}
