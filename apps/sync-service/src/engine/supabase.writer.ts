import { SupabaseDatabase } from '../../../../shared/database/supabase.client';
import {
  IParticipantRecord,
  IEventRecord,
  ITeamRecord,
  ITeamMemberRecord,
  IRegistrationRecord,
} from '../../../../shared/models/types';
import { logger } from '../../../../shared/logger/pino.logger';
import { env } from '../../../../shared/config/env.config';

export class SupabaseWriter {
  private static chunkArray<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }
    return chunks;
  }

  public async upsertParticipants(participants: IParticipantRecord[]): Promise<number> {
    if (participants.length === 0) return 0;
    let totalUpserted = 0;
    const chunks = SupabaseWriter.chunkArray(participants, env.SYNC_BATCH_SIZE);

    for (const chunk of chunks) {
      const { error } = await SupabaseDatabase.client
        .from('participants')
        .upsert(chunk, { onConflict: 'registration_id' });

      if (error) {
        logger.error({ error, chunkCount: chunk.length }, '❌ Error upserting participants batch into Supabase');
        throw error;
      }
      totalUpserted += chunk.length;
    }
    return totalUpserted;
  }

  public async upsertEvents(events: IEventRecord[]): Promise<number> {
    if (events.length === 0) return 0;
    let totalUpserted = 0;
    const chunks = SupabaseWriter.chunkArray(events, env.SYNC_BATCH_SIZE);

    for (const chunk of chunks) {
      const { error } = await SupabaseDatabase.client
        .from('events')
        .upsert(chunk, { onConflict: 'event_id' });

      if (error) {
        logger.error({ error, chunkCount: chunk.length }, '❌ Error upserting events batch into Supabase');
        throw error;
      }
      totalUpserted += chunk.length;
    }
    return totalUpserted;
  }

  public async upsertTeams(teams: ITeamRecord[]): Promise<number> {
    if (teams.length === 0) return 0;
    let totalUpserted = 0;
    const chunks = SupabaseWriter.chunkArray(teams, env.SYNC_BATCH_SIZE);

    for (const chunk of chunks) {
      const { error } = await SupabaseDatabase.client
        .from('teams')
        .upsert(chunk, { onConflict: 'team_id' });

      if (error) {
        logger.error({ error, chunkCount: chunk.length }, '❌ Error upserting teams batch into Supabase');
        throw error;
      }
      totalUpserted += chunk.length;
    }
    return totalUpserted;
  }

  public async upsertTeamMembers(members: ITeamMemberRecord[]): Promise<number> {
    if (members.length === 0) return 0;
    let totalUpserted = 0;
    const chunks = SupabaseWriter.chunkArray(members, env.SYNC_BATCH_SIZE);

    for (const chunk of chunks) {
      const { error } = await SupabaseDatabase.client
        .from('team_members')
        .upsert(chunk, { onConflict: 'team_id,user_id' });

      if (error) {
        logger.error({ error, chunkCount: chunk.length }, '❌ Error upserting team members batch into Supabase');
        throw error;
      }
      totalUpserted += chunk.length;
    }
    return totalUpserted;
  }

  public async upsertRegistrations(registrations: IRegistrationRecord[]): Promise<number> {
    if (registrations.length === 0) return 0;
    let totalUpserted = 0;
    const chunks = SupabaseWriter.chunkArray(registrations, env.SYNC_BATCH_SIZE);

    for (const chunk of chunks) {
      const { error } = await SupabaseDatabase.client
        .from('registrations')
        .upsert(chunk, { onConflict: 'registration_id,event_id' });

      if (error) {
        logger.error({ error, chunkCount: chunk.length }, '❌ Error upserting registrations batch into Supabase');
        throw error;
      }
      totalUpserted += chunk.length;
    }
    return totalUpserted;
  }
}
