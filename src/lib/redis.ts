import { Redis } from '@upstash/redis'
import { REDIS_CONFIG } from '@/config/redis'
import { errorHandler } from '@/services/errorHandler'

// Determine if we're in a test environment
const isTestEnvironment = process.env.NODE_ENV === 'test';

// Initialize Redis client
let redis: Redis;

if (isTestEnvironment) {
  console.log('Using mock Redis client for testing');
  
  // Simple mock implementation for testing
  const mockData = new Map<string, any>();
  const mockHashData = new Map<string, Map<string, any>>();
  const mockZsetData = new Map<string, Map<string, number>>();
  
  redis = {
    // Basic operations
    get: async (key: string) => mockData.get(key) || null,
    set: async (key: string, value: any) => {
      mockData.set(key, value);
      return 'OK';
    },
    del: async (key: string) => {
      mockData.delete(key);
      return 1;
    },
    keys: async (pattern: string) => {
      // Simple pattern matching for tests
      const keys = Array.from(mockData.keys());
      if (pattern === '*') return keys;
      
      // Basic wildcard support
      const regex = new RegExp(pattern.replace('*', '.*'));
      return keys.filter(key => regex.test(key));
    },
    expire: async () => true,
    
    // Hash operations
    hset: async (key: string, field: string, value: string) => {
      if (!mockHashData.has(key)) {
        mockHashData.set(key, new Map());
      }
      mockHashData.get(key)?.set(field, value);
      return 1;
    },
    hget: async (key: string, field: string) => {
      return mockHashData.get(key)?.get(field) || null;
    },
    
    // Sorted set operations
    zadd: async (key: string, score: any, member: any) => {
      if (!mockZsetData.has(key)) {
        mockZsetData.set(key, new Map());
      }
      
      if (typeof score === 'object' && 'score' in score && 'member' in score) {
        // Handle { score, member } format
        mockZsetData.get(key)?.set(score.member, score.score);
      } else {
        // Handle score, member format
        mockZsetData.get(key)?.set(member, score);
      }
      
      return 1;
    },
    zrange: async (key: string, start: number, stop: number) => {
      const zset = mockZsetData.get(key);
      if (!zset) return [];
      
      // Sort by score and extract members
      const entries = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
      const rangeEnd = stop === -1 ? entries.length : Math.min(stop + 1, entries.length);
      return entries.slice(start, rangeEnd).map(entry => entry[0]);
    },
    zrem: async (key: string, member: string) => {
      const zset = mockZsetData.get(key);
      if (!zset || !zset.has(member)) return 0;
      
      zset.delete(member);
      return 1;
    },
    zcard: async (key: string) => {
      return mockZsetData.get(key)?.size || 0;
    },
    zremrangebyscore: async () => 0,
    
    // Pipeline operations
    pipeline: () => {
      const commands: any[] = [];
      return {
        zremrangebyscore: () => {
          commands.push(['zremrangebyscore']);
          return { zcard: () => {
            commands.push(['zcard', 0]);
            return { exec: async () => [null, [null, 0]] };
          }};
        }
      };
    },
    
    // Multi operations (mock for atomicTransaction)
    multi: () => {
      const commands: any[] = [];
      // List of supported Redis commands for multi
      const commandList = [
        'set', 'get', 'del', 'hset', 'hget', 'zadd', 'zrange', 'zrem', 'zcard', 'zremrangebyscore', 'expire', 'incr', 'incrby'
      ];
      const multiObj: any = {};
      for (const cmd of commandList) {
        multiObj[cmd] = (...args: any[]) => {
          commands.push([cmd, ...args]);
          return multiObj;
        };
      }
      multiObj.exec = async () => {
        // Simulate execution: return an array of [null, null] for each command
        return commands.map(() => [null, null]);
      };
      return multiObj;
    },
    
    // Multi-key operations with proper signature
    mset: async (...args: any[]) => {
      // Handle keyvalue pairs
      for (let i = 0; i < args.length; i += 2) {
        if (i + 1 < args.length) {
          mockData.set(args[i], args[i + 1]);
        }
      }
      return 'OK';
    },
    
    // Additional operations needed for the system
    incr: async (key: string) => {
      const value = mockData.get(key);
      const newValue = value ? parseInt(value) + 1 : 1;
      mockData.set(key, newValue.toString());
      return newValue;
    },
    incrby: async (key: string, increment: number) => {
      const value = mockData.get(key);
      const newValue = value ? parseInt(value) + increment : increment;
      mockData.set(key, newValue.toString());
      return newValue;
    }
  } as unknown as Redis;
} else {
  try {
    // Use actual Redis client for production/development
    redis = new Redis({
      url: typeof import.meta !== 'undefined' && import.meta.env ? 
        import.meta.env.VITE_UPSTASH_REDIS_URL : 
        process.env.VITE_UPSTASH_REDIS_URL || '',
      token: typeof import.meta !== 'undefined' && import.meta.env ? 
        import.meta.env.VITE_UPSTASH_REDIS_TOKEN : 
        process.env.VITE_UPSTASH_REDIS_TOKEN || ''
    });
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    throw error;
  }
}

// Export the Redis client
export { redis }

// Helper functions for common Redis operations
export const redisHelpers = {
  /**
   * Get a value from Redis
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key)
      if (data === null) return null
      
      if (typeof data === 'string' && data.startsWith('{') && data.endsWith('}')) {
        try {
          return JSON.parse(data) as T
        } catch {
          return data as unknown as T
        }
      }
      
      return data as T
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to get data from Redis: ${key}`)
      )
      return null
    }
  },

  /**
   * Set a value in Redis
   */
  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      let valueToStore = value

      // Stringify objects
      if (typeof value === 'object' && value !== null) {
        valueToStore = JSON.stringify(value)
      }

      if (ttlSeconds) {
        await redis.set(key, valueToStore, { ex: ttlSeconds })
      } else {
        await redis.set(key, valueToStore)
      }
      
      return true
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to set data in Redis: ${key}`)
      )
      return false
    }
  },

  /**
   * Delete keys from Redis
   */
  async delete(key: string, ...moreKeys: string[]): Promise<boolean> {
    try {
      const keys = [key, ...moreKeys].filter(Boolean)
      if (keys.length === 0) return false
      
      if (keys.length === 1) {
        await redis.del(key)
      } else {
        // Use a different approach for multiple keys
        for (const k of keys) {
          await redis.del(k)
        }
      }
      
      return true
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to delete data from Redis: ${key}`)
      )
      return false
    }
  },

  /**
   * Check if a key exists in Redis
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.get(key)
      return result !== null
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to check if key exists in Redis: ${key}`)
      )
      return false
    }
  },

  /**
   * Get keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    try {
      return await redis.keys(pattern)
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to get keys from Redis: ${pattern}`)
      )
      return []
    }
  },

  /**
   * Set a value in Redis only if the key does not exist
   */
  async setNX(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      let valueToStore = value

      // Stringify objects
      if (typeof value === 'object' && value !== null) {
        valueToStore = JSON.stringify(value)
      }

      // Set with NX flag
      let result: any;
      
      if (ttlSeconds) {
        result = await redis.set(key, valueToStore, { nx: true, ex: ttlSeconds })
      } else {
        result = await redis.set(key, valueToStore, { nx: true })
      }
      
      return result === 'OK'
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to set data with NX in Redis: ${key}`)
      )
      return false
    }
  },

  /**
   * Increment a value in Redis
   */
  async increment(key: string, amount = 1): Promise<number> {
    try {
      const result = await redis.incrby(key, amount)
      return typeof result === 'number' ? result : 0
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to increment value in Redis: ${key}`)
      )
      return 0
    }
  },

  /**
   * Set expiration (TTL) for a key
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await redis.expire(key, seconds)
      return result === 1
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to set expiration in Redis: ${key}`)
      )
      return false
    }
  },

  /**
   * Get TTL for a key
   */
  async ttl(key: string): Promise<number> {
    try {
      const result = await redis.ttl(key)
      return typeof result === 'number' ? result : -2
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to get TTL from Redis: ${key}`)
      )
      return -2
    }
  },

  /**
   * Get multiple values from Redis
   */
  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    try {
      if (keys.length === 0) return []
      
      // Handle mget in a typesafe way
      const results: any[] = []
      
      // Process keys in batches if large number
      const batchSize = 10
      for (let i = 0; i < keys.length; i += batchSize) {
        const batch = keys.slice(i, i + batchSize)
        // Process one key at a time for type safety
        for (const key of batch) {
          const value = await redis.get(key)
          results.push(value)
        }
      }
      
      return results.map((item: any) => {
        if (item === null) return null
        
        if (typeof item === 'string' && item.startsWith('{') && item.endsWith('}')) {
          try {
            return JSON.parse(item) as T
          } catch {
            return item as unknown as T
          }
        }
        
        return item as T
      })
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to get multiple values from Redis: ${keys.join(', ')}`)
      )
      return keys.map(() => null)
    }
  },

  /**
   * Set multiple values in Redis
   */
  async mset(items: { key: string; value: any }[]): Promise<boolean> {
    try {
      if (items.length === 0) return false
      
      // Create a key-value object for mset instead of using spread
      const keyValueMap: Record<string, string> = {}
      
      // Prepare items for mset
      for (const item of items) {
        let valueToStore = item.value
        
        // Stringify objects
        if (typeof item.value === 'object' && item.value !== null) {
          valueToStore = JSON.stringify(item.value)
        }
        
        keyValueMap[item.key] = String(valueToStore)
      }
      
      // Use the object form of mset
      await redis.mset(keyValueMap)
      return true
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to set multiple values in Redis`)
      )
      return false
    }
  },

  /**
   * Hash operations
   */
  hash: {
    /**
     * Get a field from a hash
     */
    async get<T>(key: string, field: string): Promise<T | null> {
      try {
        const data = await redis.hget(key, field)
        if (data === null) return null
        
        if (typeof data === 'string' && data.startsWith('{') && data.endsWith('}')) {
          try {
            return JSON.parse(data) as T
          } catch {
            return data as unknown as T
          }
        }
        
        return data as T
      } catch (error: any) {
        errorHandler.logError(
          error instanceof Error
            ? error
            : new Error(`Failed to get hash field from Redis: ${key}.${field}`)
        )
        return null
      }
    },

    /**
     * Set a field in a hash
     */
    async set(key: string, field: string, value: any): Promise<boolean> {
      try {
        let valueToStore = value
        
        // Stringify objects
        if (typeof value === 'object' && value !== null) {
          valueToStore = JSON.stringify(value)
        }
        
        // Convert to proper hset format for Upstash/Redis
        const result = await redis.hset(key, { [field]: valueToStore })
        return result > 0
      } catch (error: any) {
        errorHandler.logError(
          error instanceof Error
            ? error
            : new Error(`Failed to set hash field in Redis: ${key}.${field}`)
        )
        return false
      }
    },

    /**
     * Get all fields from a hash
     */
    async getAll<T>(key: string): Promise<Record<string, T> | null> {
      try {
        const data = await redis.hgetall(key)
        
        if (!data || Object.keys(data).length === 0) {
          return null
        }
        
        // Try to parse each field
        const result: Record<string, any> = {}
        
        for (const [field, value] of Object.entries(data)) {
          if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
            try {
              result[field] = JSON.parse(value)
            } catch {
              result[field] = value
            }
          } else {
            result[field] = value
          }
        }
        
        return result as Record<string, T>
      } catch (error: any) {
        errorHandler.logError(
          error instanceof Error
            ? error
            : new Error(`Failed to get all hash fields from Redis: ${key}`)
        )
        return null
      }
    },
  },

  /**
   * List operations
   */
  list: {
    /**
     * Push values to the end of a list
     */
    async push(key: string, ...values: any[]): Promise<number> {
      try {
        if (values.length === 0) return 0
        
        // Convert objects to strings
        const processedValues = values.map(value => {
          if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value)
          }
          return value
        })
        
        // Handle values one by one if multiple
        let result: number = 0
        for (const val of processedValues) {
          const res = await redis.rpush(key, val)
          if (typeof res === 'number') {
            result = res // Will hold the final length
          }
        }
        
        return result
      } catch (error: any) {
        errorHandler.logError(
          error instanceof Error
            ? error
            : new Error(`Failed to push to list in Redis: ${key}`)
        )
        return 0
      }
    },

    /**
     * Get a range of items from a list
     */
    async range<T>(key: string, start = 0, stop = -1): Promise<T[]> {
      try {
        const data = await redis.lrange(key, start, stop)
        
        return data.map((item: any) => {
          if (typeof item === 'string') {
            try {
              return JSON.parse(item) as T
            } catch {
              return item as unknown as T
            }
          }
          return item as T
        })
      } catch (error: any) {
        errorHandler.logError(
          error instanceof Error
            ? error
            : new Error(`Failed to get range from list in Redis: ${key}`)
        )
        return []
      }
    },
  },

  /**
   * Sorted Set operations
   */
  zset: {
    /**
     * Add a member to a sorted set
     */
    async add(key: string, score: number, member: string): Promise<boolean> {
      try {
        // Use the object format which is more reliable
        const result = await redis.zadd(key, { score, member })
        return result === 1
      } catch (error: any) {
        errorHandler.logError(
          error instanceof Error
            ? error
            : new Error(`Failed to add to sorted set in Redis: ${key}`)
        )
        return false
      }
    },

    /**
     * Get members from a sorted set by range
     */
    async range(
      key: string, 
      start: number = 0, 
      stop: number = -1, 
      options?: { withScores?: boolean }
    ): Promise<string[]> {
      try {
        const result = await redis.zrange(key, start, stop, options)
        return result as string[]
      } catch (error: any) {
        errorHandler.logError(
          error instanceof Error
            ? error
            : new Error(`Failed to get range from sorted set in Redis: ${key}`)
        )
        return []
      }
    },

    /**
     * Remove members from a sorted set
     */
    async remove(key: string, ...members: string[]): Promise<number> {
      try {
        if (members.length === 0) return 0
        
        // Remove members one by one
        let totalRemoved = 0
        for (const member of members) {
          const result = await redis.zrem(key, member)
          if (typeof result === 'number') {
            totalRemoved += result
          }
        }
        
        return totalRemoved
      } catch (error: any) {
        errorHandler.logError(
          error instanceof Error
            ? error
            : new Error(`Failed to remove from sorted set in Redis: ${key}`)
        )
        return 0
      }
    },

    /**
     * Get the number of members in a sorted set
     */
    async count(key: string): Promise<number> {
      try {
        const result = await redis.zcard(key)
        return typeof result === 'number' ? result : 0
      } catch (error: any) {
        errorHandler.logError(
          error instanceof Error
            ? error
            : new Error(`Failed to get count from sorted set in Redis: ${key}`)
        )
        return 0
      }
    },
  },

  /**
   * Create a distributed lock
   * @returns A release function to release the lock
   */
  async acquireLock(
    key: string, 
    ttlSeconds = 30, 
    retryCount = 5, 
    retryDelayMs = 200
  ): Promise<(() => Promise<void>) | null> {
    const lockId = Math.random().toString(36).substring(2)
    let attempt = 0
    
    while (attempt < retryCount) {
      try {
        const acquired = await this.setNX(`lock:${key}`, lockId, ttlSeconds)
        
        if (acquired) {
          // Return a function to release the lock
          return async () => {
            try {
              // Check if we still own the lock before deleting
              const currentLockId = await this.get<string>(`lock:${key}`)
              if (currentLockId === lockId) {
                await this.delete(`lock:${key}`)
              }
            } catch (error: any) {
              errorHandler.logError(
                error instanceof Error
                  ? error
                  : new Error(`Failed to release lock in Redis: ${key}`)
              )
            }
          }
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelayMs))
        attempt++
      } catch (error: any) {
        errorHandler.logError(
          error instanceof Error
            ? error
            : new Error(`Failed to acquire lock in Redis: ${key}`)
        )
        return null
      }
    }
    
    return null // Failed to acquire lock
  },

  /**
   * Create a rate limiter
   * @returns true if action is allowed, false if rate limited
   */
  async rateLimit(
    key: string,
    limit: number,
    windowSeconds: number
  ): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000)
    const rateLimitKey = `${REDIS_CONFIG.PREFIX.RATE_LIMIT}${key}`
    
    try {
      // Remove old entries
      await redis.zremrangebyscore(
        rateLimitKey,
        0,
        now - windowSeconds
      )
      
      // Count current entries
      const count = await redis.zcard(rateLimitKey)
      
      if (typeof count === 'number' && count >= limit) {
        return false // Rate limited
      }
      
      // Add current request
      await redis.zadd(rateLimitKey, {
        score: now,
        member: `${now}:${Math.random().toString(36).substring(2)}`
      })
      
      // Set expiration on the set
      await redis.expire(rateLimitKey, windowSeconds * 2)
      
      return true // Not rate limited
    } catch (error: any) {
      errorHandler.logError(
        error instanceof Error
          ? error
          : new Error(`Failed to check rate limit in Redis: ${key}`)
      )
      
      // In case of error, allow the request (fail open)
      return true
    }
  },
}

// Connection check utility
export async function checkRedisConnection(): Promise<boolean> {
  try {
    // Upstash Redis does not support PING, so use a simple get/set/delete as a health check
    const testKey = '__redis_health_check__';
    await redis.set(testKey, 'ok');
    const value = await redis.get(testKey);
    await redis.del(testKey);
    return value === 'ok';
  } catch (e) {
    console.error('Redis connection check failed:', e);
    return false;
  }
} 