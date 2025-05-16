import { redis } from '../lib/redis';

/**
 * Sliding Window Rate Limiter
 * 
 * This implementation provides a more accurate rate limiting approach than a
 * simple counter with expiration. The sliding window algorithm tracks actions
 * over time and gradually expires old counts, providing a smoother limitation
 * that prevents request spikes at expiration boundaries.
 */
export class SlidingWindowRateLimiter {
  /**
   * Check if a given action is allowed under rate limits and increment count if allowed
   * 
   * @param key Unique identifier for the action (usually includes user ID)
   * @param maxRequests Maximum allowed requests in the time window
   * @param windowSizeSeconds Size of the sliding window in seconds
   * @returns Object with isAllowed flag and remaining count
   */
  async isAllowed(
    key: string,
    maxRequests: number,
    windowSizeSeconds: number
  ): Promise<{ isAllowed: boolean; remaining: number; resetSeconds: number }> {
    const now = Math.floor(Date.now() / 1000);
    const windowStartTime = now - windowSizeSeconds;
    
    // Sliding window is implemented using a Redis sorted set
    // Each action is recorded with a timestamp score
    const setKey = `rate_limit:${key}`;
    
    try {
      // Execute as transaction to ensure atomicity
      const pipeline = redis.pipeline();
      
      // Remove expired entries (older than the window)
      pipeline.zremrangebyscore(setKey, 0, windowStartTime);
      
      // Get current count in the window
      pipeline.zcard(setKey);
      
      // Execute pipeline
      const [, currentCount] = await pipeline.exec() as any;
      
      // Check if limit is reached
      if (currentCount[1] >= maxRequests) {
        // Get the oldest timestamp in the set to calculate reset time
        const oldestTimestamp = await redis.zrange(setKey, 0, 0, { 
          withScores: true 
        });
        let resetSeconds = windowSizeSeconds;
        
        if (oldestTimestamp && oldestTimestamp.length >= 2) {
          const oldestTime = parseInt(String(oldestTimestamp[1]));
          resetSeconds = Math.max(1, oldestTime + windowSizeSeconds - now);
        }
        
        return {
          isAllowed: false,
          remaining: 0,
          resetSeconds
        };
      }
      
      // Action is allowed, add it to the set with current timestamp as score
      await redis.zadd(setKey, {
        score: now,
        member: `${now}:${Math.random().toString(36).substring(2, 15)}`
      });
      
      // Set expiration on the whole set
      await redis.expire(setKey, windowSizeSeconds * 2);
      
      return {
        isAllowed: true,
        remaining: maxRequests - (currentCount[1] + 1),
        resetSeconds: windowSizeSeconds
      };
    } catch (error) {
      console.error('Rate limit error:', error);
      
      // Fail open to prevent blocking legitimate users due to Redis errors
      return {
        isAllowed: true,
        remaining: 1,
        resetSeconds: 0
      };
    }
  }
  
  /**
   * Get the current count for a key without incrementing
   * 
   * @param key Unique identifier for the action
   * @param windowSizeSeconds Size of the sliding window in seconds
   * @returns Current count in the window
   */
  async getCurrentCount(key: string, windowSizeSeconds: number): Promise<number> {
    const now = Math.floor(Date.now() / 1000);
    const windowStartTime = now - windowSizeSeconds;
    const setKey = `rate_limit:${key}`;
    
    try {
      // First remove expired entries
      await redis.zremrangebyscore(setKey, 0, windowStartTime);
      
      // Then get current count
      return await redis.zcard(setKey);
    } catch (error) {
      console.error('Rate limit count error:', error);
      return 0;
    }
  }
  
  /**
   * Reset the rate limit counter for a specific key
   * 
   * @param key Unique identifier to reset
   * @returns Success indicator
   */
  async reset(key: string): Promise<boolean> {
    try {
      const setKey = `rate_limit:${key}`;
      await redis.del(setKey);
      return true;
    } catch (error) {
      console.error('Rate limit reset error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const slidingWindowRateLimiter = new SlidingWindowRateLimiter(); 