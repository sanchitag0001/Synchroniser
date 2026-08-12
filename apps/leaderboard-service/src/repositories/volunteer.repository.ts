import { SupabaseDatabase } from '../../../../shared/database/supabase.client';

export class VolunteerRepository {
  public async findByVolunteerId(volunteerId: string): Promise<any | null> {
    const { data, error } = await SupabaseDatabase.client
      .from('volunteers')
      .select('*, assignedEvent:events(*)')
      .eq('volunteer_id', volunteerId)
      .single();

    if (error || !data) return null;
    return data;
  }

  public async getActiveSessionsForEvent(eventId: string): Promise<any[]> {
    const { data, error } = await SupabaseDatabase.client
      .from('volunteers')
      .select('volunteer_id, name, assigned_event_id, active_session_token, active_device_id, last_login_at')
      .eq('assigned_event_id', eventId)
      .not('active_session_token', 'is', null);

    if (error) return [];
    return data || [];
  }

  public async updateSession(volunteerId: string, token: string, deviceId: string): Promise<void> {
    await SupabaseDatabase.client
      .from('volunteers')
      .update({
        active_session_token: token,
        active_device_id: deviceId,
        last_login_at: new Date().toISOString(),
      })
      .eq('volunteer_id', volunteerId);
  }

  public async clearSession(volunteerId: string): Promise<void> {
    await SupabaseDatabase.client
      .from('volunteers')
      .update({
        active_session_token: null,
        active_device_id: null,
      })
      .eq('volunteer_id', volunteerId);
  }

  public async invalidateOldestSessionForEvent(eventId: string, excludeVolunteerId?: string): Promise<void> {
    let query = SupabaseDatabase.client
      .from('volunteers')
      .select('volunteer_id, last_login_at')
      .eq('assigned_event_id', eventId)
      .not('active_session_token', 'is', null)
      .order('last_login_at', { ascending: true })
      .limit(1);

    if (excludeVolunteerId) {
      query = query.neq('volunteer_id', excludeVolunteerId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      await this.clearSession(data[0].volunteer_id);
    }
  }
}
