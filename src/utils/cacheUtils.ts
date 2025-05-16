import { redis } from '@/lib/redis';
import { REDIS_CONFIG } from '@/config/redis';

interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

const defaultOptions: Required<CacheOptions> = {
  ttl: REDIS_CONFIG.TTL.DEFAULT,
  prefix: REDIS_CONFIG.PREFIX.CACHE,
};

/**
 * Get a cached value
 */
export async function getCached<T>(
  key: string,
  options: CacheOptions = {}
): Promise<T | null> {
  const { prefix } = { ...defaultOptions, ...options };
  const fullKey = `${prefix}${key}`;

  try {
    const cached = await redis.get(fullKey as any);
    if (!cached) return null;

    return JSON.parse(cached) as T;
  } catch (error) {
    console.error('Error getting cached value:', error);
    return null;
  }
}

/**
 * Set a cached value
 */
export async function setCached<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<boolean> {
  const { ttl, prefix } = { ...defaultOptions, ...options };
  const fullKey = `${prefix}${key}`;

  try {
    const serialized = JSON.stringify(value);
    
    if (ttl > 0) {
      await redis.set(fullKey, serialized, { ex: ttl });
    } else {
      await redis.set(fullKey, serialized);
    }

    return true;
  } catch (error) {
    console.error('Error setting cached value:', error);
    return false;
  }
}

/**
 * Delete a cached value
 */
export async function deleteCached(
  key: string,
  options: CacheOptions = {}
): Promise<boolean> {
  const { prefix } = { ...defaultOptions, ...options };
  const fullKey = `${prefix}${key}`;

  try {
    await redis.del(fullKey);
    return true;
  } catch (error) {
    console.error('Error deleting cached value:', error);
    return false;
  }
}

/**
 * Get or set cached value
 */
export async function getOrSetCached<T>(
  key: string,
  getter: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T | null> {
  // Try to get from cache first
  const cached = await getCached<T>(key, options);
  if (cached !== null) {
    return cached;
  }

  try {
    // Get fresh value
    const value = await getter();
    
    // Cache the value
    await setCached(key, value, options);
    
    return value;
  } catch (error) {
    console.error('Error in getOrSetCached:', error);
    return null;
  }
}

/**
 * Clear cache by pattern
 */
export async function clearCacheByPattern(
  pattern: string,
  options: CacheOptions = {}
): Promise<number> {
  const { prefix } = { ...defaultOptions, ...options };
  const fullPattern = `${prefix}${pattern}`;

  try {
    let cleared = 0;
    let cursor = 0;
    
    do {
      // Scan for keys in batches
      const [nextCursor, keys] = await redis.scan(
        cursor.toString(),
        { match: fullPattern, count: 100 }
      );
      cursor = Number(nextCursor);

      if (keys.length > 0) {
        // Delete found keys one by one
        await Promise.all(keys.map(key => redis.del(key)));
        cleared += keys.length;
      }
    } while (cursor !== 0);

    return cleared;
  } catch (error) {
    console.error('Error clearing cache by pattern:', error);
    return 0;
  }
}

/**
 * Cache with hash field
 */
export async function hashCacheGet<T>(
  key: string,
  field: string,
  options: CacheOptions = {}
): Promise<T | null> {
  const { prefix } = { ...defaultOptions, ...options };
  const fullKey = `${prefix}${key}`;

  try {
    const value = await redis.hget(fullKey as any, field);
    if (!value) return null;

    return JSON.parse(value) as T;
  } catch (error) {
    console.error('Error getting hash cache:', error);
    return null;
  }
}

/**
 * Set hash cache field
 */
export async function hashCacheSet<T>(
  key: string,
  field: string,
  value: T,
  options: CacheOptions = {}
): Promise<boolean> {
  const { ttl, prefix } = { ...defaultOptions, ...options };
  const fullKey = `${prefix}${key}`;

  try {
    const serialized = JSON.stringify(value);
    
    // Use HSET with field-value pair
    const fieldValuePair = { [field]: serialized };
    await redis.hset(fullKey, fieldValuePair);
    
    if (ttl > 0) {
      await redis.expire(fullKey, ttl);
    }

    return true;
  } catch (error) {
    console.error('Error setting hash cache:', error);
    return false;
  }
}

/**
 * Delete hash cache field
 */
export async function hashCacheDelete(
  key: string,
  field: string,
  options: CacheOptions = {}
): Promise<boolean> {
  const { prefix } = { ...defaultOptions, ...options };
  const fullKey = `${prefix}${key}`;

  try {
    await redis.hdel(fullKey, field);
    return true;
  } catch (error) {
    console.error('Error deleting hash cache:', error);
    return false;
  }
}

/**
 * Get or set hash cache field
 */
export async function hashCacheGetOrSet<T>(
  key: string,
  field: string,
  getter: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T | null> {
  // Try to get from cache first
  const cached = await hashCacheGet<T>(key, field, options);
  if (cached !== null) {
    return cached;
  }

  try {
    // Get fresh value
    const value = await getter();
    
    // Cache the value
    await hashCacheSet(key, field, value, options);
    
    return value;
  } catch (error) {
    console.error('Error in hashCacheGetOrSet:', error);
    return null;
  }
} 