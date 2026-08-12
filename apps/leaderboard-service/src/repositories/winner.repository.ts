import { SupabaseDatabase } from '../../../../shared/database/supabase.client';

export class WinnerRepository {
  public async getWinnersForEvent(eventId: string): Promise<any[]> {
    const { data, error } = await SupabaseDatabase.client
      .from('winners')
      .select(`
        *,
        participant:participants (
          registration_id,
          name,
          college
        ),
        team:teams (
          team_id,
          team_name
        ),
        declaredByVolunteer:volunteers!winners_declared_by_fkey (
          volunteer_id,
          name
        )
      `)
      .eq('event_id', eventId)
      .order('position', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  public async setWinner(params: {
    eventId: string;
    position: number;
    registrationId?: string | null;
    teamId?: string | null;
    pointsAwarded: number;
    enteredBy: string;
    remarks?: string;
  }): Promise<any> {
    const nowIso = new Date().toISOString();

    const { data, error } = await SupabaseDatabase.client
      .from('winners')
      .upsert(
        {
          event_id: params.eventId,
          position: params.position,
          registration_id: params.registrationId || null,
          team_id: params.teamId || null,
          points_awarded: params.pointsAwarded,
          declared_by: params.enteredBy,
          declared_at: nowIso,
          last_modified_by: params.enteredBy,
          last_modified_at: nowIso,
          remarks: params.remarks || null,
        },
        { onConflict: 'event_id,position' }
      )
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  public async getTotalWinnersCount(): Promise<number> {
    const { count, error } = await SupabaseDatabase.client
      .from('winners')
      .select('*', { count: 'exact', head: true });

    if (error) return 0;
    return count || 0;
  }

  public async getAllWinnersForExport(): Promise<any[]> {
    const { data, error } = await SupabaseDatabase.client
      .from('winners')
      .select(`
        *,
        event:events(name, category),
        participant:participants(name, college, email, phone)
      `)
      .order('event_id', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
