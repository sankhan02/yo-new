import { redis } from '@/lib/redis';
import { REDIS_CONFIG } from '@/config/redis';

interface RateLimitInfo {
  remaining: number;
  reset: number;
  total: number;
}

/**
 * Check if a request is within rate limits
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const clearAt = now + windowSeconds;

  try {
    // Get current count
    const count = await redis.incr(key);

    // Set expiration on first request
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }

    return count <= limit;
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On Redis error, allow the request
    return true;
  }
}

/**
 * Get rate limit information for a key
 */
export async function getRateLimitInfo(
  key: string
): Promise<RateLimitInfo | null> {
  try {
    const [count, ttl] = await Promise.all([
      redis.get(key),
      redis.ttl(key),
    ]);

    if (!count || ttl < 0) {
      return null;
    }

    const numericCount = Number(count);
    const limit = await getKeyLimit(key);

    return {
      remaining: Math.max(0, limit - numericCount),
      reset: ttl,
      total: limit,
    };
  } catch (error) {
    console.error('Error getting rate limit info:', error);
    return null;
  }
}

/**
 * Get the rate limit for a key based on its prefix
 */
async function getKeyLimit(key: string): Promise<number> {
  // Default to 100 requests per minute
  const DEFAULT_LIMIT = 100;

  try {
    // Extract prefix from key (e.g., "api:" from "rate-limit:api:...")
    const parts = key.split(':');
    if (parts.length < 3) return DEFAULT_LIMIT;

    const prefix = parts[1];

    // Get limit from Redis hash
    const limit = await redis.hget('rate-limits', prefix);
    return limit ? Number(limit) : DEFAULT_LIMIT;
  } catch (error) {
    console.error('Error getting rate limit:', error);
    return DEFAULT_LIMIT;
  }
}

/**
 * Set custom rate limit for a prefix
 */
export async function setRateLimit(
  prefix: string,
  limit: number
): Promise<boolean> {
  try {
    await redis.hset('rate-limits', { [prefix]: limit.toString() });
    return true;
  } catch (error) {
    console.error('Error setting rate limit:', error);
    return false;
  }
}

/**
 * Reset rate limit counter
 */
export async function resetRateLimit(key: string): Promise<boolean> {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error('Error resetting rate limit:', error);
    return false;
  }
}

/**
 * Check multiple rate limits at once
 */
export async function checkMultipleRateLimits(
  limits: Array<{
    key: string;
    limit: number;
    windowSeconds: number;
  }>
): Promise<boolean> {
  try {
    const results = await Promise.all(
      limits.map(({ key, limit, windowSeconds }) =>
        checkRateLimit(key, limit, windowSeconds)
      )
    );

    return results.every(Boolean);
  } catch (error) {
    console.error('Error checking multiple rate limits:', error);
    // On error, allow the request
    return true;
  }
}

/**
 * Get rate limit info for multiple keys
 */
export async function getMultipleRateLimitInfo(
  keys: string[]
): Promise<Record<string, RateLimitInfo | null>> {
  try {
    const results = await Promise.all(
      keys.map(key => getRateLimitInfo(key))
    );

    return keys.reduce((acc, key, index) => {
      acc[key] = results[index];
      return acc;
    }, {} as Record<string, RateLimitInfo | null>);
  } catch (error) {
    console.error('Error getting multiple rate limit info:', error);
    return {};
  }
}

// Helper function to create rate limit keys
export function createRateLimitKey(
  walletAddress: string,
  action: string
): string {
  return `ratelimit:${walletAddress}:${action}`;
}

// Specific rate limit checks for different actions
export async function canPerformAction(
  walletAddress: string,
  action: string,
  limit = 10,
  windowSeconds = 60
): Promise<boolean> {
  const key = createRateLimitKey(walletAddress, action);
  return checkRateLimit(key, limit, windowSeconds);
}

// Rate limit middleware for Vue components
export function useRateLimit(
  action: string,
  limit = 10,
  windowSeconds = 60
) {
  return async (walletAddress: string): Promise<boolean> => {
    return canPerformAction(walletAddress, action, limit, windowSeconds);
  };
} 