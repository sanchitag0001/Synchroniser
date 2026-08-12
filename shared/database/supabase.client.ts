import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.config';
import { logger } from '../logger/pino.logger';

export class SupabaseDatabase {
  private static instance: SupabaseClient | null = null;

  public static get client(): SupabaseClient {
    if (!this.instance) {
      logger.info({ url: env.SUPABASE_URL }, '⚡ Initializing Supabase PostgreSQL Client Singleton...');
      this.instance = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
        db: {
          schema: 'public',
        },
      });
    }
    return this.instance;
  }

  public static async ping(): Promise<boolean> {
    try {
      const pingPromise = this.client.from('events').select('id').limit(1);
      const timeoutPromise = new Promise<{ error: any }>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase ping connection timeout (2000ms)')), 2000)
      );

      const { error } = await Promise.race([pingPromise, timeoutPromise]);
      if (error && error.code !== 'PGRST116') {
        logger.warn({ error }, '⚠️ Supabase health check warning');
        return false;
      }
      return true;
    } catch (e: any) {
      logger.warn({ msg: e.message }, '⚠️ Supabase ping failed or timed out (will retry on incoming requests)');
      return false;
    }
  }
}
