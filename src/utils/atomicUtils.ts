import { redis } from '@/lib/redis';
import { REDIS_CONFIG } from '@/config/redis';

export async function incrementAndGet(key: string, amount = 1): Promise<number | null> {
  try {
    const result = await redis.incrby(`${REDIS_CONFIG.PREFIX.CACHE}${key}`, amount);
    return result;
  } catch (error) {
    console.error('Increment and get error:', error);
    return null;
  }
}

export async function decrementAndGet(key: string, amount = 1): Promise<number | null> {
  try {
    const result = await redis.decrby(`${REDIS_CONFIG.PREFIX.CACHE}${key}`, amount);
    return result;
  } catch (error) {
    console.error('Decrement and get error:', error);
    return null;
  }
}

export async function getAndSet<T>(key: string, value: T): Promise<T | null> {
  const prefixedKey = `${REDIS_CONFIG.PREFIX.CACHE}${key}`;
  try {
    const oldValue = await redis.getset(prefixedKey, JSON.stringify(value));
    return oldValue ? JSON.parse(oldValue as string) : null;
  } catch (error) {
    console.error('Get and set error:', error);
    return null;
  }
}

export async function setIfNotExists<T>(
  key: string,
  value: T,
  ttl?: number
): Promise<boolean> {
  const prefixedKey = `${REDIS_CONFIG.PREFIX.CACHE}${key}`;
  try {
    const options: any = { nx: true };
    if (ttl) {
      options.ex = ttl;
    }
    
    const result = await redis.set(prefixedKey, JSON.stringify(value), options);
    return result !== null;
  } catch (error) {
    console.error('Set if not exists error:', error);
    return false;
  }
}

export async function updateIfExists<T>(
  key: string,
  value: T,
  ttl?: number
): Promise<boolean> {
  const prefixedKey = `${REDIS_CONFIG.PREFIX.CACHE}${key}`;
  try {
    const options: any = { xx: true };
    if (ttl) {
      options.ex = ttl;
    }
    
    const result = await redis.set(prefixedKey, JSON.stringify(value), options);
    return result !== null;
  } catch (error) {
    console.error('Update if exists error:', error);
    return false;
  }
}

// Optimistic locking pattern for atomic updates
export async function optimisticUpdate<T>(
  key: string,
  updateFn: (currentValue: T | null) => T,
  maxRetries = 3
): Promise<boolean> {
  const prefixedKey = `${REDIS_CONFIG.PREFIX.CACHE}${key}`;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      // Get current value
      const currentValue = await redis.get(prefixedKey);
      const parsedValue = currentValue ? JSON.parse(currentValue as string) as T : null;
      
      // Calculate new value
      const newValue = updateFn(parsedValue);
      
      // Try to update
      const result = await redis.set(prefixedKey, JSON.stringify(newValue));
      return result !== null;
    } catch (error) {
      attempts++;
      if (attempts === maxRetries) {
        console.error('Optimistic update failed:', error);
        return false;
      }
      // Add small random delay before retry
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    }
  }

  return false;
}

interface LockOptions {
  ttl?: number;
  retryCount?: number;
  retryDelay?: number;
}

const DEFAULT_LOCK_OPTIONS: Required<LockOptions> = {
  ttl: 30, // 30 seconds
  retryCount: 5,
  retryDelay: 200, // 200ms
};

/**
 * Acquire a distributed lock using Redis
 */
export async function acquireLock(
  key: string,
  options: LockOptions = {}
): Promise<string | null> {
  const { ttl, retryCount, retryDelay } = {
    ...DEFAULT_LOCK_OPTIONS,
    ...options,
  };

  const lockToken = Math.random().toString(36).substring(2);
  let attempts = 0;

  while (attempts < retryCount) {
    const acquired = await redis.set(
      `lock:${key}`,
      lockToken,
      { nx: true, ex: ttl }
    );

    if (acquired) {
      return lockToken;
    }

    await new Promise(resolve => setTimeout(resolve, retryDelay));
    attempts++;
  }

  return null;
}

/**
 * Release a distributed lock
 */
export async function releaseLock(key: string, token: string): Promise<boolean> {
  const script = `
    if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  try {
    const result = await redis.eval(
      script,
      [key],
      [token]
    );
    return result === 1;
  } catch (error) {
    console.error('Error releasing lock:', error);
    return false;
  }
}

/**
 * Execute a function with a distributed lock
 */
export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  options: LockOptions = {}
): Promise<T | null> {
  const token = await acquireLock(key, options);
  if (!token) {
    console.error('Failed to acquire lock:', key);
    return null;
  }

  try {
    const result = await fn();
    return result;
  } finally {
    await releaseLock(key, token);
  }
}

/**
 * Increment a counter atomically with optimistic locking
 */
export async function atomicIncrement(
  key: string,
  increment: number = 1,
  options: LockOptions = {}
): Promise<number | null> {
  return withLock(key, async () => {
    const value = await redis.incr(key);
    return value;
  }, options);
}

/**
 * Update a value atomically with optimistic locking
 */
export async function atomicUpdate<T>(
  key: string,
  updateFn: (currentValue: T | null) => Promise<T>,
  options: LockOptions = {}
): Promise<T | null> {
  return withLock(key, async () => {
    const currentValue = await redis.get(key);
    const parsed = currentValue ? JSON.parse(currentValue as string) as T : null;
    const newValue = await updateFn(parsed);
    await redis.set(key, JSON.stringify(newValue));
    return newValue;
  }, options);
}

/**
 * Execute multiple commands atomically in a transaction
 */
export async function atomicTransaction<T>(
  commands: Array<[string, ...any[]]>
): Promise<T[]> {
  try {
    const multi = redis.multi();
    
    for (const [command, ...args] of commands) {
      // @ts-ignore - Redis multi typing issue
      multi[command.toLowerCase()](...args);
    }
    
    const results = await multi.exec();
    return results as T[];
  } catch (error) {
    console.error('Transaction error:', error);
    return [];
  }
} 