import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export class CacheService {
  private static instance: CacheService;
  private client: RedisClientType;
  private isConnected: boolean = false;

  private constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 60000,
      },
    });

    this.client.on('error', (err) => {
      logger.error('Redis Client Error:', err);
      this.isConnected = false;
    });

    this.client.on('connect', () => {
      logger.info('Connected to Redis');
      this.isConnected = true;
    });

    this.client.on('disconnect', () => {
      logger.warn('Disconnected from Redis');
      this.isConnected = false;
    });
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  public async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.client.connect();
      } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        throw error;
      }
    }
  }

  public async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  // Cache methods with TTL (Time To Live)
  public async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const serializedValue = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  public async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      return value && typeof value === 'string' ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  public async delete(key: string): Promise<boolean> {
    try {
      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  public async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result > 0;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  public async expire(key: string, ttlSeconds: number): Promise<boolean> {
    try {
      const result = await this.client.expire(key, ttlSeconds);
      return result > 0;
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
      return false;
    }
  }

  // Batch operations
  public async mset<T>(keyValuePairs: Record<string, T>, ttlSeconds?: number): Promise<void> {
    try {
      const pipeline = this.client.multi();
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        const serializedValue = JSON.stringify(value);
        if (ttlSeconds) {
          pipeline.setEx(key, ttlSeconds, serializedValue);
        } else {
          pipeline.set(key, serializedValue);
        }
      });
      await pipeline.exec();
    } catch (error) {
      logger.error('Cache mset error:', error);
    }
  }

  public async mget<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const values = await this.client.mGet(keys);
      return values.map(value => value && typeof value === 'string' ? JSON.parse(value) : null);
    } catch (error) {
      logger.error('Cache mget error:', error);
      return new Array(keys.length).fill(null);
    }
  }

  // Cache keys patterns
  public async deletePattern(pattern: string): Promise<number> {
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        const result = await this.client.del(keys);
        return result;
      }
      return 0;
    } catch (error) {
      logger.error(`Cache delete pattern error for ${pattern}:`, error);
      return 0;
    }
  }

  // User-specific cache methods
  public getUserKey(userId: string, type: string = 'profile'): string {
    return `user:${userId}:${type}`;
  }

  public getOrderKey(orderId: string, type: string = 'details'): string {
    return `order:${orderId}:${type}`;
  }

  public getDeliveryKey(deliveryId: string, type: string = 'details'): string {
    return `delivery:${deliveryId}:${type}`;
  }

  public getStatsKey(type: string, period: string = 'daily'): string {
    return `stats:${type}:${period}`;
  }

  // Cache user data
  public async cacheUser<T>(userId: string, userData: T, ttlSeconds: number = 3600): Promise<void> {
    const key = this.getUserKey(userId);
    await this.set(key, userData, ttlSeconds);
  }

  public async getCachedUser<T>(userId: string): Promise<T | null> {
    const key = this.getUserKey(userId);
    return await this.get<T>(key);
  }

  public async invalidateUserCache(userId: string): Promise<void> {
    const pattern = `user:${userId}:*`;
    await this.deletePattern(pattern);
  }

  // Cache order data
  public async cacheOrder<T>(orderId: string, orderData: T, ttlSeconds: number = 1800): Promise<void> {
    const key = this.getOrderKey(orderId);
    await this.set(key, orderData, ttlSeconds);
  }

  public async getCachedOrder<T>(orderId: string): Promise<T | null> {
    const key = this.getOrderKey(orderId);
    return await this.get<T>(key);
  }

  public async invalidateOrderCache(orderId: string): Promise<void> {
    const pattern = `order:${orderId}:*`;
    await this.deletePattern(pattern);
  }

  // Cache delivery data
  public async cacheDelivery<T>(deliveryId: string, deliveryData: T, ttlSeconds: number = 1800): Promise<void> {
    const key = this.getDeliveryKey(deliveryId);
    await this.set(key, deliveryData, ttlSeconds);
  }

  public async getCachedDelivery<T>(deliveryId: string): Promise<T | null> {
    const key = this.getDeliveryKey(deliveryId);
    return await this.get<T>(key);
  }

  public async invalidateDeliveryCache(deliveryId: string): Promise<void> {
    const pattern = `delivery:${deliveryId}:*`;
    await this.deletePattern(pattern);
  }

  // Cache statistics
  public async cacheStats<T>(type: string, statsData: T, ttlSeconds: number = 300): Promise<void> {
    const key = this.getStatsKey(type);
    await this.set(key, statsData, ttlSeconds);
  }

  public async getCachedStats<T>(type: string): Promise<T | null> {
    const key = this.getStatsKey(type);
    return await this.get<T>(key);
  }

  public async invalidateStatsCache(type: string): Promise<void> {
    const pattern = `stats:${type}:*`;
    await this.deletePattern(pattern);
  }

  // Health check
  public async ping(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // Get cache info
  public async getInfo(): Promise<Record<string, string> | null> {
    try {
      const info = await this.client.info();
      return this.parseRedisInfo(info);
    } catch (error) {
      logger.error('Failed to get Redis info:', error);
      return null;
    }
  }

  private parseRedisInfo(info: string): Record<string, string> {
    const lines = info.split('\r\n');
    const parsed: Record<string, string> = {};

    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        parsed[key] = value;
      }
    });

    return parsed;
  }
}

// Export singleton instance
export const cacheService = CacheService.getInstance();