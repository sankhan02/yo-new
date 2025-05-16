import { redis } from '@/lib/redis';
import { REDIS_CONFIG } from '@/config/redis';
import { batchDelete } from './batchUtils';

interface CleanupOptions {
  pattern: string;
  maxAge: number;
  batchSize?: number;
}

/**
 * Clean up expired keys matching a pattern
 */
export async function cleanupExpiredKeys(
  pattern: string,
  batchSize: number = 100
): Promise<number> {
  try {
    let cleaned = 0;
    let cursor = 0;
    
    do {
      // Scan for keys in batches
      const [nextCursor, keys] = await redis.scan(
        cursor,
        { match: pattern, count: batchSize }
      );
      cursor = Number(nextCursor);

      if (keys.length > 0) {
        // Check TTL for each key
        const ttls = await Promise.all(
          keys.map(key => redis.ttl(key))
        );

        // Collect keys with no TTL or expired TTL
        const toDelete = keys.filter((_, i) => ttls[i] <= 0);
        
        if (toDelete.length > 0) {
          await batchDelete(toDelete);
          cleaned += toDelete.length;
        }
      }
    } while (cursor !== 0);

    return cleaned;
  } catch (error) {
    console.error('Error cleaning up expired keys:', error);
    return 0;
  }
}

/**
 * Clean up keys older than maxAge
 */
export async function cleanupOldKeys({
  pattern,
  maxAge,
  batchSize = 100
}: CleanupOptions): Promise<number> {
  try {
    let cleaned = 0;
    let cursor = 0;
    const now = Date.now();
    
    do {
      // Scan for keys in batches
      const [nextCursor, keys] = await redis.scan(
        cursor,
        { match: pattern, count: batchSize }
      );
      cursor = Number(nextCursor);

      if (keys.length > 0) {
        // Get values to check timestamps
        const values = await Promise.all(
          keys.map(key => redis.get(key))
        );

        // Collect keys with old timestamps
        const toDelete = keys.filter((key, i) => {
          if (!values[i]) return false;
          try {
            const data = JSON.parse(values[i] as string);
            return data.timestamp && (now - data.timestamp > maxAge);
          } catch {
            return false;
          }
        });

        if (toDelete.length > 0) {
          await batchDelete(toDelete);
          cleaned += toDelete.length;
        }
      }
    } while (cursor !== 0);

    return cleaned;
  } catch (error) {
    console.error('Error cleaning up old keys:', error);
    return 0;
  }
}

/**
 * Set up cleanup schedules
 */
export function setupCleanupSchedules(): void {
  // Clean up expired session keys
  setInterval(
    () => cleanupExpiredKeys(`${REDIS_CONFIG.PREFIX.SESSION}*`),
    REDIS_CONFIG.CLEANUP.INTERVAL
  );

  // Clean up expired game states
  setInterval(
    () => cleanupOldKeys({
      pattern: `${REDIS_CONFIG.PREFIX.GAME}*`,
      maxAge: REDIS_CONFIG.CLEANUP.INACTIVE_GAMES_MAX_AGE * 1000
    }),
    REDIS_CONFIG.CLEANUP.INTERVAL
  );

  // Clean up expired rate limit keys
  setInterval(
    () => cleanupExpiredKeys(`${REDIS_CONFIG.PREFIX.RATE_LIMIT}*`),
    REDIS_CONFIG.CLEANUP.INTERVAL
  );

  // Clean up expired cache keys
  setInterval(
    () => cleanupExpiredKeys(`${REDIS_CONFIG.PREFIX.CACHE}*`),
    REDIS_CONFIG.CLEANUP.INTERVAL
  );
}

// Initialize cleanup schedules
setupCleanupSchedules(); 