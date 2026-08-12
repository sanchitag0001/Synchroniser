import { SupabaseDatabase } from '../../../../shared/database/supabase.client';
import { ISyncLogRecord } from '../../../../shared/models/types';
import { logger } from '../../../../shared/logger/pino.logger';

export class SyncLogRepository {
  public async create(log: ISyncLogRecord): Promise<string | null> {
    try {
      const { data, error } = await SupabaseDatabase.client
        .from('sync_logs')
        .insert({
          sync_type: log.sync_type,
          status: log.status,
          started_at: log.started_at,
          completed_at: log.completed_at,
          duration_ms: log.duration_ms,
          added_count: log.added_count,
          updated_count: log.updated_count,
          deleted_count: log.deleted_count,
          failed_count: log.failed_count,
          details: log.details || {},
          error_message: log.error_message,
        })
        .select('id')
        .single();

      if (error) {
        logger.error({ error }, '❌ Failed to write sync log entry to Supabase');
        return null;
      }
      return data.id;
    } catch (e) {
      logger.error({ e }, '❌ Exception writing sync log');
      return null;
    }
  }

  public async update(id: string, updates: Partial<ISyncLogRecord>): Promise<void> {
    try {
      await SupabaseDatabase.client
        .from('sync_logs')
        .update({
          status: updates.status,
          completed_at: updates.completed_at,
          duration_ms: updates.duration_ms,
          added_count: updates.added_count,
          updated_count: updates.updated_count,
          deleted_count: updates.deleted_count,
          failed_count: updates.failed_count,
          details: updates.details,
          error_message: updates.error_message,
        })
        .eq('id', id);
    } catch (e) {
      logger.error({ e, id }, '❌ Exception updating sync log');
    }
  }

  public async getLastSuccessfulCheckpoint(): Promise<Date | null> {
    try {
      const { data, error } = await SupabaseDatabase.client
        .from('sync_logs')
        .select('started_at')
        .eq('status', 'COMPLETED')
        .order('started_at', { ascending: false })
        .limit(1);

      if (error || !data || data.length === 0) {
        return null;
      }

      return new Date(data[0].started_at);
    } catch (e) {
      logger.warn({ e }, '⚠️ Could not read last sync checkpoint, will fallback to full sync');
      return null;
    }
  }

  public async getLatestLogs(limit: number = 10): Promise<any[]> {
    try {
      const { data, error } = await SupabaseDatabase.client
        .from('sync_logs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (e) {
      logger.error({ e }, '❌ Failed to fetch sync logs');
      return [];
    }
  }
}
