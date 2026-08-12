import { SupabaseDatabase } from '../../../../shared/database/supabase.client';

export class AttendanceRepository {
  public async findByEventAndRegistration(eventId: string, registrationId: string): Promise<any | null> {
    const { data, error } = await SupabaseDatabase.client
      .from('attendance')
      .select('*')
      .eq('event_id', eventId)
      .eq('registration_id', registrationId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  public async markAttendance(params: {
    eventId: string;
    registrationId: string;
    teamId?: string | null;
    scannedBy: string;
    deviceId?: string | null;
    scanMode?: 'ONLINE' | 'OFFLINE';
    scanTime?: string;
    deviceTimestamp?: string;
    offlineSyncId: string;
  }): Promise<{ isNew: boolean; record: any }> {
    // Check existing
    const existing = await this.findByEventAndRegistration(params.eventId, params.registrationId);
    if (existing) {
      return { isNew: false, record: existing };
    }

    const nowIso = new Date().toISOString();
    const scanTimeIso = params.scanTime || nowIso;

    const { data, error } = await SupabaseDatabase.client
      .from('attendance')
      .insert({
        event_id: params.eventId,
        registration_id: params.registrationId,
        team_id: params.teamId || null,
        scanned_by: params.scannedBy,
        device_id: params.deviceId || null,
        scan_mode: params.scanMode || 'ONLINE',
        scan_time: scanTimeIso,
        sync_time: nowIso,
        device_timestamp: params.deviceTimestamp || scanTimeIso,
        offline_sync_id: params.offlineSyncId,
        present: true,
      })
      .select('*')
      .single();

    if (error) {
      // If error is duplicate key conflict (race condition), fetch existing
      if (error.code === '23505') {
        const raceExisting = await this.findByEventAndRegistration(params.eventId, params.registrationId);
        return { isNew: false, record: raceExisting };
      }
      throw error;
    }

    return { isNew: true, record: data };
  }

  public async getAttendanceForEvent(eventId: string): Promise<any[]> {
    const { data, error } = await SupabaseDatabase.client
      .from('attendance')
      .select(`
        *,
        participant:participants (
          name,
          college,
          email,
          phone
        ),
        scannedVolunteer:volunteers (
          name
        )
      `)
      .eq('event_id', eventId)
      .order('scan_time', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  public async isParticipantPresent(eventId: string, registrationId: string): Promise<boolean> {
    const { data } = await SupabaseDatabase.client
      .from('attendance')
      .select('id, present')
      .eq('event_id', eventId)
      .eq('registration_id', registrationId)
      .eq('present', true)
      .maybeSingle();

    return Boolean(data);
  }

  public async getTotalAttendanceCount(): Promise<number> {
    const { count, error } = await SupabaseDatabase.client
      .from('attendance')
      .select('*', { count: 'exact', head: true })
      .eq('present', true);

    if (error) return 0;
    return count || 0;
  }

  public async getAttendanceCountPerEvent(): Promise<Record<string, number>> {
    const { data, error } = await SupabaseDatabase.client
      .from('attendance')
      .select('event_id')
      .eq('present', true);

    if (error || !data) return {};

    const counts: Record<string, number> = {};
    for (const item of data) {
      counts[item.event_id] = (counts[item.event_id] || 0) + 1;
    }
    return counts;
  }
}
