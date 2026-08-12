import { SupabaseDatabase } from '../../../../shared/database/supabase.client';
import { NotificationPublishDto } from '../../../../shared/models/types';

export class NotificationRepository {
  public async getActiveNotifications(targetEventId?: string): Promise<any[]> {
    let query = SupabaseDatabase.client
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false });

    if (targetEventId) {
      query = query.or(`target_event_id.is.null,target_event_id.eq.${targetEventId}`);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Filter out expired notifications
    const now = new Date();
    return (data || []).filter((n) => !n.expires_at || new Date(n.expires_at) > now);
  }

  public async createNotification(dto: NotificationPublishDto): Promise<any> {
    const { data, error } = await SupabaseDatabase.client
      .from('notifications')
      .insert({
        title: dto.title,
        message: dto.message,
        priority: dto.priority || 'MEDIUM',
        target_event_id: dto.targetEventId || null,
        expires_at: dto.expiresAt || null,
        created_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }
}
