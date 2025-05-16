import { redis } from '@/lib/redis';
import { REDIS_CONFIG } from '@/config/redis';

interface BatchOperation<T = any> {
  command: string;
  args: T[];
}

export async function executeBatch<T = any>(operations: BatchOperation<T>[]) {
  try {
    const pipeline = redis.pipeline();
    
    for (const { command, args } of operations) {
      // @ts-ignore - Redis pipeline typing issue
      pipeline[command.toLowerCase()](...args);
    }
    
    return await pipeline.exec();
  } catch (error) {
    console.error('Batch operation error:', error);
    return null;
  }
}

export async function batchGet(keys: string[]): Promise<Record<string, any>> {
  try {
    const pipeline = redis.pipeline();
    
    for (const key of keys) {
      pipeline.get(key);
    }
    
    const results = await pipeline.exec();
    if (!results) return {};
    
    return results.reduce<Record<string, any>>((acc, result, index) => {
      if (result) {
        try {
          acc[keys[index]] = JSON.parse(result as string);
        } catch {
          acc[keys[index]] = result;
        }
      } else {
        acc[keys[index]] = null;
      }
      return acc;
    }, {});
  } catch (error) {
    console.error('Batch get error:', error);
    return {};
  }
}

export async function batchDelete(keys: string[]): Promise<boolean> {
  try {
    if (keys.length === 0) return true;
    
    const pipeline = redis.pipeline();
    
    for (const key of keys) {
      pipeline.del(key);
    }
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error('Batch delete error:', error);
    return false;
  }
}

export async function batchExists(keys: string[]): Promise<Record<string, boolean>> {
  try {
    const pipeline = redis.pipeline();
    const prefixedKeys = keys.map(key => `${REDIS_CONFIG.PREFIX.CACHE}${key}`);
    
    prefixedKeys.forEach(key => {
      pipeline.exists(key);
    });

    const results = await pipeline.exec();
    if (!results) return {};

    const output: Record<string, boolean> = {};
    results.forEach((result, index) => {
      output[keys[index]] = result === 1;
    });

    return output;
  } catch (error) {
    console.error('Batch exists error:', error);
    return {};
  }
}

export async function batchSet(keyValues: Record<string, any>, ttl?: number): Promise<boolean> {
  try {
    const pipeline = redis.pipeline();
    
    for (const [key, value] of Object.entries(keyValues)) {
      if (ttl) {
        pipeline.set(key, JSON.stringify(value), { ex: ttl });
      } else {
        pipeline.set(key, JSON.stringify(value));
      }
    }
    
    await pipeline.exec();
    return true;
  } catch (error) {
    console.error('Batch set error:', error);
    return false;
  }
}

interface BatchScore {
  userId: string;
  score: number;
}

/**
 * Batch update scores using Redis pipelining
 */
export async function batchUpdateScores(
  leaderboard: string,
  scores: BatchScore[],
): Promise<boolean> {
  const key = `${REDIS_CONFIG.PREFIX.LEADERBOARD}${leaderboard}`;
  
  try {
    const pipeline = redis.pipeline();
    
    // Add all score updates to pipeline
    for (const { userId, score } of scores) {
      pipeline.zadd(key, { score, member: userId });
    }
    
    // Execute pipeline
    await pipeline.exec();
    
    return true;
  } catch (error) {
    console.error('Error in batch score update:', error);
    return false;
  }
}

/**
 * Batch get scores using Redis pipelining
 */
export async function batchGetScores(
  leaderboard: string,
  userIds: string[],
): Promise<Map<string, number>> {
  const key = `${REDIS_CONFIG.PREFIX.LEADERBOARD}${leaderboard}`;
  const scores = new Map<string, number>();
  
  try {
    const pipeline = redis.pipeline();
    
    // Add all score queries to pipeline
    for (const userId of userIds) {
      pipeline.zscore(key, userId);
    }
    
    // Execute pipeline
    const results = await pipeline.exec();
    
    // Process results
    if (results) {
      results.forEach((result, index) => {
        const [error, score] = result as [Error | null, string | null];
        if (!error && score !== null) {
          scores.set(userIds[index], Number(score));
        }
      });
    }
    
    return scores;
  } catch (error) {
    console.error('Error in batch score retrieval:', error);
    return new Map();
  }
}

/**
 * Batch delete scores using Redis pipelining
 */
export async function batchDeleteScores(
  leaderboard: string,
  userIds: string[],
): Promise<boolean> {
  const key = `${REDIS_CONFIG.PREFIX.LEADERBOARD}${leaderboard}`;
  
  try {
    const pipeline = redis.pipeline();
    
    // Add all deletions to pipeline
    for (const userId of userIds) {
      pipeline.zrem(key, userId);
    }
    
    // Execute pipeline
    await pipeline.exec();
    
    return true;
  } catch (error) {
    console.error('Error in batch score deletion:', error);
    return false;
  }
}

/**
 * Batch cache operations using Redis pipelining
 */
export async function batchCacheOperations<T>(
  operations: Array<{
    type: 'get' | 'set' | 'del';
    key: string;
    value?: T;
    ttl?: number;
  }>,
): Promise<Array<T | null>> {
  try {
    const pipeline = redis.pipeline();
    
    // Add all operations to pipeline
    for (const op of operations) {
      const fullKey = `${REDIS_CONFIG.PREFIX.CACHE}${op.key}`;
      
      switch (op.type) {
        case 'get':
          pipeline.get(fullKey);
          break;
        case 'set':
          if (op.ttl) {
            pipeline.set(fullKey, JSON.stringify(op.value), { ex: op.ttl });
          } else {
            pipeline.set(fullKey, JSON.stringify(op.value));
          }
          break;
        case 'del':
          pipeline.del(fullKey);
          break;
      }
    }
    
    // Execute pipeline
    const results = await pipeline.exec();
    
    // Process results
    if (!results) return new Array(operations.length).fill(null);
    
    return results.map(result => {
      const [error, value] = result as [Error | null, string | null];
      if (error || value === null) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as unknown as T;
      }
    });
    
  } catch (error) {
    console.error('Error in batch cache operations:', error);
    return new Array(operations.length).fill(null);
  }
} 