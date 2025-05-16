import type { NextFunction, Request, Response } from 'express';
import { REDIS_CONFIG } from '@/config/redis';
import { checkRateLimit, getRateLimitInfo } from '@/utils/rateLimitUtils';

interface RateLimitOptions {
  limit?: number;
  windowSeconds?: number;
  keyPrefix?: string;
  errorMessage?: string;
  identifierFn?: (req: Request) => string;
}

const defaultOptions: Required<RateLimitOptions> = {
  limit: REDIS_CONFIG.RATE_LIMIT.DEFAULT.limit,
  windowSeconds: REDIS_CONFIG.RATE_LIMIT.DEFAULT.windowSeconds,
  keyPrefix: REDIS_CONFIG.PREFIX.RATE_LIMIT,
  errorMessage: 'Too many requests, please try again later.',
  identifierFn: (req) => req.ip || 'unknown',
};

/**
 * Create a rate limiting middleware
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  const {
    limit,
    windowSeconds,
    keyPrefix,
    errorMessage,
    identifierFn,
  } = { ...defaultOptions, ...options };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const identifier = identifierFn(req);
      const key = `${keyPrefix}${identifier}:${req.method}:${req.baseUrl}${req.path}`;

      const allowed = await checkRateLimit(key, limit, windowSeconds);

      if (!allowed) {
        const info = await getRateLimitInfo(key);
        
        // Set rate limit headers
        if (info) {
          res.set({
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': (limit - info.remaining).toString(),
            'X-RateLimit-Reset': info.reset.toString(),
          });
        }

        return res.status(429).json({
          error: errorMessage,
          retryAfter: info?.reset || windowSeconds,
        });
      }

      // Continue to next middleware
      next();
    } catch (error) {
      console.error('Rate limit middleware error:', error);
      // On Redis error, allow the request
      next();
    }
  };
}

/**
 * Middleware for API rate limiting
 */
export const apiRateLimiter = createRateLimiter({
  limit: REDIS_CONFIG.RATE_LIMIT.API.limit,
  windowSeconds: REDIS_CONFIG.RATE_LIMIT.API.windowSeconds,
  keyPrefix: `${REDIS_CONFIG.PREFIX.RATE_LIMIT}api:`,
});

/**
 * Middleware for game action rate limiting
 */
export const gameActionRateLimiter = createRateLimiter({
  limit: REDIS_CONFIG.RATE_LIMIT.GAME_ACTIONS.limit,
  windowSeconds: REDIS_CONFIG.RATE_LIMIT.GAME_ACTIONS.windowSeconds,
  keyPrefix: `${REDIS_CONFIG.PREFIX.RATE_LIMIT}game:`,
  identifierFn: (req) => {
    const walletAddress = req.headers['x-wallet-address'] as string;
    return walletAddress || req.ip || 'unknown';
  },
}); 