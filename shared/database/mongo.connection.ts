import mongoose from 'mongoose';
import { env } from '../config/env.config';
import { logger } from '../logger/pino.logger';

export class MongoDatabase {
  private static isConnected: boolean = false;

  public static async connect(): Promise<typeof mongoose> {
    if (this.isConnected) {
      return mongoose;
    }

    try {
      logger.info({ uri: env.MONGODB_URI.replace(/:[^:@]+@/, ':****@') }, '🔌 Connecting to MongoDB Atlas...');

      mongoose.connection.on('connected', () => {
        this.isConnected = true;
        logger.info('✅ MongoDB Atlas connected successfully (Read Pool Active)');
      });

      mongoose.connection.on('error', (err) => {
        this.isConnected = false;
        logger.error({ err }, '❌ MongoDB Atlas connection error');
      });

      mongoose.connection.on('disconnected', () => {
        this.isConnected = false;
        logger.warn('⚠️ MongoDB Atlas disconnected. Retrying connection...');
      });

      await mongoose.connect(env.MONGODB_URI, {
        dbName: env.MONGODB_DB_NAME,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
        readPreference: 'secondaryPreferred', // Read-only scaling preference
      });

      this.isConnected = true;
      return mongoose;
    } catch (error) {
      this.isConnected = false;
      logger.error({ error }, '❌ Failed to connect to MongoDB Atlas. Will retry automatically.');
      throw error;
    }
  }

  public static async disconnect(): Promise<void> {
    if (this.isConnected) {
      await mongoose.disconnect();
      this.isConnected = false;
      logger.info('🔌 MongoDB Atlas connection closed.');
    }
  }

  public static get status(): boolean {
    return this.isConnected && mongoose.connection.readyState === 1;
  }
}
