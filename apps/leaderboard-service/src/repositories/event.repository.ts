import { SupabaseDatabase } from '../../../../shared/database/supabase.client';

export class EventRepository {
  public async findAll(): Promise<any[]> {
    const { data, error } = await SupabaseDatabase.client
      .from('events')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  public async findByEventId(eventId: string): Promise<any | null> {
    const { data, error } = await SupabaseDatabase.client
      .from('events')
      .select('*')
      .eq('event_id', eventId)
      .single();

    if (error || !data) return null;
    return data;
  }

  public async getParticipantsForEvent(eventId: string, presentOnly: boolean = false): Promise<any[]> {
    // 1. Fetch confirmed registrations for the event
    const { data: registrations, error } = await SupabaseDatabase.client
      .from('registrations')
      .select(`
        registration_id,
        registration_type,
        status,
        team_id,
        participant:participants (
          registration_id,
          name,
          college,
          email,
          phone,
          gender,
          age,
          course,
          semester
        ),
        team:teams (
          team_id,
          team_name,
          leader_id
        )
      `)
      .eq('event_id', eventId)
      .eq('status', 'CONFIRMED');

    if (error) throw error;
    if (!registrations) return [];

    // 2. If presentOnly is requested, filter strictly against attendance table
    if (presentOnly) {
      const { data: attendanceList, error: attError } = await SupabaseDatabase.client
        .from('attendance')
        .select('registration_id, present, scan_time')
        .eq('event_id', eventId)
        .eq('present', true);

      if (attError) throw attError;

      const presentRegIds = new Set((attendanceList || []).map((a) => a.registration_id));
      return registrations.filter((r) => presentRegIds.has(r.registration_id));
    }

    return registrations;
  }
}
