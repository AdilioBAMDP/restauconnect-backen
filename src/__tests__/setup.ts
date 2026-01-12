// Setup file for Jest
import { logger } from '../utils/logger';
import { connectDatabase, disconnectDatabase } from '../database/connection';

beforeAll(async () => {
  logger.info('🧪 Starting tests...');
  // Ensure test DB is connected before running tests
  await connectDatabase();
});

afterAll(async () => {
  // Disconnect cleanly to avoid Jest open handle leaks
  await disconnectDatabase();
  logger.info('✅ Tests completed');
});

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.MONGODB_URI = 'mongodb://localhost:27017/restauconnect-test';

