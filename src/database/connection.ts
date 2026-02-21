import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    // Disable auto index creation in production to prevent duplicate index warnings
    mongoose.set('autoIndex', false);
    
    await mongoose.connect(config.database.uri, {
      // Connection options
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false
    } as any);

    logger.info(`MongoDB Connected: ${mongoose.connection.host}`);
    
    // Connection event handlers
    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected');
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      logger.info('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (error) {
    logger.error('MongoDB connection failed', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  } catch (error) {
    logger.error('Error closing MongoDB connection', error);
  }
};