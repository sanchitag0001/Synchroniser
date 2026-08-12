import { MongoReader } from './mongo.reader';
import { SupabaseWriter } from './supabase.writer';
import { SyncLogRepository } from '../repositories/sync_log.repository';
import { MongoDatabase } from '../../../../shared/database/mongo.connection';
import { logger } from '../../../../shared/logger/pino.logger';

export interface SyncExecutionResult {
  syncType: 'MANUAL' | 'SCHEDULED' | 'INCREMENTAL';
  status: 'COMPLETED' | 'FAILED';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  participantsSynced: number;
  eventsSynced: number;
  teamsSynced: number;
  teamMembersSynced: number;
  registrationsSynced: number;
  totalSynced: number;
  errorMessage?: string;
}

export class IncrementalSyncEngine {
  private mongoReader: MongoReader;
  private supabaseWriter: SupabaseWriter;
  private syncLogRepo: SyncLogRepository;
  private isSyncInProgress: boolean = false;
  private lastSuccessfulSyncTimestamp: Date | null = null;

  constructor() {
    this.mongoReader = new MongoReader();
    this.supabaseWriter = new SupabaseWriter();
    this.syncLogRepo = new SyncLogRepository();
  }

  public async initialize(): Promise<void> {
    try {
      this.lastSuccessfulSyncTimestamp = await this.syncLogRepo.getLastSuccessfulCheckpoint();
      logger.info(
        { lastCheckpoint: this.lastSuccessfulSyncTimestamp?.toISOString() || 'None (Initial Boot)' },
        '⚙️ Incremental Sync Engine initialized'
      );
    } catch (e) {
      logger.warn({ e }, '⚠️ Could not read last sync checkpoint during initialization');
    }
  }

  public async runSync(forceFull: boolean = false, syncType: 'MANUAL' | 'SCHEDULED' = 'SCHEDULED'): Promise<SyncExecutionResult> {
    if (this.isSyncInProgress) {
      logger.warn('⚠️ A synchronization cycle is already running. Skipping overlapping execution.');
      return {
        syncType,
        status: 'FAILED',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        participantsSynced: 0,
        eventsSynced: 0,
        teamsSynced: 0,
        teamMembersSynced: 0,
        registrationsSynced: 0,
        totalSynced: 0,
        errorMessage: 'Synchronization in progress',
      };
    }

    this.isSyncInProgress = true;
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    // Determine mode
    const isIncremental = !forceFull && this.lastSuccessfulSyncTimestamp !== null;
    const effectiveSyncType = isIncremental ? 'INCREMENTAL' : syncType;
    const sinceFilter = isIncremental ? this.lastSuccessfulSyncTimestamp! : undefined;

    logger.info(
      { type: effectiveSyncType, since: sinceFilter?.toISOString() || 'ALL_TIME' },
      '🚀 Starting data synchronization from MongoDB Atlas to Supabase...'
    );

    // Create running log record
    const logId = await this.syncLogRepo.create({
      sync_type: effectiveSyncType,
      status: 'RUNNING',
      started_at: startedAt,
      added_count: 0,
      updated_count: 0,
      deleted_count: 0,
      failed_count: 0,
      details: { forceFull, sinceFilter },
    });

    try {
      // 1. Ensure MongoDB connection
      if (!MongoDatabase.status) {
        await MongoDatabase.connect();
      }

      // 2. Fetch from MongoDB (Read Only)
      const participants = await this.mongoReader.fetchParticipants(sinceFilter);
      const events = await this.mongoReader.fetchEvents(sinceFilter);
      const teams = await this.mongoReader.fetchTeams(sinceFilter);
      const teamMembers = await this.mongoReader.fetchTeamMembers(sinceFilter);
      const registrations = await this.mongoReader.fetchRegistrations(sinceFilter);

      // 3. Upsert into Supabase (Conflict Safe)
      // Foreign Key Dependency Order:
      // a. Participants & Events first
      // b. Teams & Registrations
      // c. Team Members
      const pCount = await this.supabaseWriter.upsertParticipants(participants);
      const eCount = await this.supabaseWriter.upsertEvents(events);
      const tCount = await this.supabaseWriter.upsertTeams(teams);
      const rCount = await this.supabaseWriter.upsertRegistrations(registrations);
      const tmCount = await this.supabaseWriter.upsertTeamMembers(teamMembers);

      const totalSynced = pCount + eCount + tCount + rCount + tmCount;
      const durationMs = Date.now() - startTime;
      const completedAt = new Date().toISOString();

      this.lastSuccessfulSyncTimestamp = new Date();

      logger.info(
        {
          durationMs: `${durationMs}ms`,
          participants: pCount,
          events: eCount,
          teams: tCount,
          registrations: rCount,
          teamMembers: tmCount,
          total: totalSynced,
        },
        '✅ Sync cycle finished successfully'
      );

      // Update log record
      if (logId) {
        await this.syncLogRepo.update(logId, {
          status: 'COMPLETED',
          completed_at: completedAt,
          duration_ms: durationMs,
          added_count: totalSynced,
          updated_count: 0,
          failed_count: 0,
          details: {
            participants: pCount,
            events: eCount,
            teams: tCount,
            registrations: rCount,
            teamMembers: tmCount,
          },
        });
      }

      return {
        syncType: effectiveSyncType,
        status: 'COMPLETED',
        startedAt,
        completedAt,
        durationMs,
        participantsSynced: pCount,
        eventsSynced: eCount,
        teamsSynced: tCount,
        teamMembersSynced: tmCount,
        registrationsSynced: rCount,
        totalSynced,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const completedAt = new Date().toISOString();
      const errorMsg = error.message || 'Unknown sync error';

      logger.error({ error, durationMs }, '❌ Synchronization cycle failed');

      if (logId) {
        await this.syncLogRepo.update(logId, {
          status: 'FAILED',
          completed_at: completedAt,
          duration_ms: durationMs,
          failed_count: 1,
          error_message: errorMsg,
        });
      }

      return {
        syncType: effectiveSyncType,
        status: 'FAILED',
        startedAt,
        completedAt,
        durationMs,
        participantsSynced: 0,
        eventsSynced: 0,
        teamsSynced: 0,
        teamMembersSynced: 0,
        registrationsSynced: 0,
        totalSynced: 0,
        errorMessage: errorMsg,
      };
    } finally {
      this.isSyncInProgress = false;
    }
  }

  public getStatus() {
    return {
      isSyncInProgress: this.isSyncInProgress,
      lastSuccessfulCheckpoint: this.lastSuccessfulSyncTimestamp?.toISOString() || null,
      mongoConnected: MongoDatabase.status,
    };
  }
}
