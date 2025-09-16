// Rate limiting middleware

import { createMiddleware } from 'hono/factory';
import type { Env, RateLimitResult } from '@/types';
import { createLogger } from '@/utils/logger';
import { metrics } from '@/utils/metrics';

// Rate limiting using KV as fallback to Workers Rate Limiting
export const rateLimit = (options?: {
  requestsPerMinute?: number;
  burstLimit?: number;
  keyGenerator?: (c: any) => string;
}) => createMiddleware<{ Bindings: Env }>(
  async (c, next) => {
    const logger = createLogger({ requestId: c.get('requestId') });
    
    const requestsPerMinute = options?.requestsPerMinute || 
      parseInt(c.env.RATE_LIMIT_REQUESTS_PER_MINUTE) || 100;
    const burstLimit = options?.burstLimit || 
      parseInt(c.env.RATE_LIMIT_BURST) || 20;
    
    // Generate rate limit key
    const key = options?.keyGenerator ? 
      options.keyGenerator(c) : 
      generateRateLimitKey(c);

    try {
      // Try Workers Rate Limiting first (if available)
      const rateLimitResult = await checkWorkersRateLimit(
        c, 
        key, 
        requestsPerMinute, 
        burstLimit
      );

      // Fallback to KV-based rate limiting if Workers Rate Limiting is not available
      const result = rateLimitResult || await checkKVRateLimit(
        c.env.KV_CACHE,
        key,
        requestsPerMinute,
        burstLimit
      );

      // Log rate limit check
      logger.rateLimitEvent(result.allowed, result.remaining, result.resetTime);
      metrics.recordRateLimit(result.allowed, result.remaining);

      // Set rate limit headers
      c.header('X-RateLimit-Limit', requestsPerMinute.toString());
      c.header('X-RateLimit-Remaining', result.remaining.toString());
      c.header('X-RateLimit-Reset', result.resetTime.toString());

      if (!result.allowed) {
        if (result.retryAfter) {
          c.header('Retry-After', result.retryAfter.toString());
        }

        return c.json({
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Rate limit exceeded',
            details: {
              limit: requestsPerMinute,
              remaining: result.remaining,
              resetTime: result.resetTime,
              retryAfter: result.retryAfter
            }
          },
          timestamp: new Date().toISOString(),
          requestId: c.get('requestId')
        }, 429);
      }

      await next();
    } catch (error) {
      logger.error('Rate limiting error', error as Error);
      // Don't block requests if rate limiting fails
      await next();
    }
  }
);

// Generate rate limit key
function generateRateLimitKey(c: any): string {
  // Use client IP as primary identifier
  const clientIP = c.req.header('cf-connecting-ip') || 
    c.req.header('x-forwarded-for') || 
    'unknown';
  
  // Include route in the key for per-route limiting
  const route = c.req.path;
  
  return `rate_limit:${clientIP}:${route}`;
}

// Check Workers Rate Limiting (placeholder - actual implementation depends on Workers Rate Limiting API)
async function checkWorkersRateLimit(
  c: any,
  key: string,
  limit: number,
  burst: number
): Promise<RateLimitResult | null> {
  // Workers Rate Limiting is not generally available yet
  // This is a placeholder for when it becomes available
  
  // Example API (hypothetical):
  // try {
  //   const result = await c.env.RATE_LIMITER.limit(key, {
  //     limit,
  //     period: 60000, // 1 minute
  //     burst
  //   });
  //   
  //   return {
  //     allowed: result.success,
  //     remaining: result.remaining,
  //     resetTime: result.resetTime,
  //     retryAfter: result.retryAfter
  //   };
  // } catch (error) {
  //   return null;
  // }
  
  return null;
}

// KV-based rate limiting using token bucket algorithm
async function checkKVRateLimit(
  kv: KVNamespace,
  key: string,
  limit: number,
  burst: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000; // 1-minute window
  const bucketKey = `${key}:${windowStart}`;
  
  try {
    // Get current bucket state
    const bucketData = await kv.get(bucketKey, 'json') as {
      tokens: number;
      lastRefill: number;
      requests: number;
    } | null;

    let tokens = burst;
    let requests = 0;
    let lastRefill = windowStart;

    if (bucketData) {
      tokens = bucketData.tokens;
      requests = bucketData.requests;
      lastRefill = bucketData.lastRefill;
      
      // Refill tokens based on time passed
      const timePassed = now - lastRefill;
      const tokensToAdd = Math.floor((timePassed / 60000) * limit);
      tokens = Math.min(burst, tokens + tokensToAdd);
      lastRefill = now;
    }

    // Check if request is allowed
    const allowed = tokens > 0;
    
    if (allowed) {
      tokens -= 1;
    }
    
    requests += 1;

    // Update bucket state
    const newBucketData = {
      tokens,
      lastRefill,
      requests
    };

    // Store with TTL of 2 minutes to clean up old buckets
    await kv.put(bucketKey, JSON.stringify(newBucketData), {
      expirationTtl: 120
    });

    return {
      allowed,
      remaining: Math.max(0, tokens),
      resetTime: windowStart + 60000,
      retryAfter: allowed ? undefined : Math.ceil((60000 - (now - windowStart)) / 1000)
    };
  } catch (error) {
    console.error('KV rate limiting error:', error);
    // Allow request if rate limiting fails
    return {
      allowed: true,
      remaining: limit,
      resetTime: windowStart + 60000
    };
  }
}

// Per-user rate limiting
export const perUserRateLimit = (options?: {
  requestsPerMinute?: number;
  burstLimit?: number;
}) => rateLimit({
  ...options,
  keyGenerator: (c) => {
    const auth = c.get('auth');
    const userId = auth?.userId || auth?.apiKeyValid ? 'api_key_user' : 'anonymous';
    return `rate_limit:user:${userId}:${c.req.path}`;
  }
});

// Per-IP rate limiting
export const perIPRateLimit = (options?: {
  requestsPerMinute?: number;
  burstLimit?: number;
}) => rateLimit({
  ...options,
  keyGenerator: (c) => {
    const clientIP = c.req.header('cf-connecting-ip') || 
      c.req.header('x-forwarded-for') || 
      'unknown';
    return `rate_limit:ip:${clientIP}:${c.req.path}`;
  }
});

// Stricter rate limiting for expensive operations
export const strictRateLimit = () => rateLimit({
  requestsPerMinute: 10,
  burstLimit: 5
});