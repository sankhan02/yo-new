import { checkRateLimit, getRateLimitInfo } from '@/utils/rateLimitUtils';

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
}

export async function rateLimitMiddleware(
  req: Request,
  config: RateLimitConfig = { limit: 100, windowSeconds: 60 }
): Promise<{ isAllowed: boolean; headers: RateLimitHeaders }> {
  const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
  const endpoint = new URL(req.url).pathname;
  const key = `ratelimit:${clientIp}:${endpoint}`;

  const isAllowed = await checkRateLimit(key, config.limit, config.windowSeconds);
  const limitInfo = await getRateLimitInfo(key);

  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': config.limit.toString(),
    'X-RateLimit-Remaining': limitInfo ? (config.limit - (limitInfo.remaining || 0)).toString() : '0',
    'X-RateLimit-Reset': limitInfo ? limitInfo.reset.toString() : '0'
  };

  return { isAllowed, headers };
}

// Example usage in an API route:
/*
export async function onRequest(context: EventContext<Env, string, Data>) {
  const { isAllowed, headers } = await rateLimitMiddleware(context.request, {
    limit: 50,
    windowSeconds: 60
  });

  if (!isAllowed) {
    return new Response('Rate limit exceeded', {
      status: 429,
      headers: {
        ...headers,
        'Retry-After': headers['X-RateLimit-Reset']
      }
    });
  }

  // Continue with the request handling...
  const response = await handleRequest(context);
  
  // Add rate limit headers to the response
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
*/ 