import { createMiddleware } from "hono/factory";

import type { Env, RateLimitResult } from "#api/types";
import { createLogger } from "#api/utils/logger";
import { metrics } from "#api/utils/metrics";

// Rate limiting using KV as fallback to Workers Rate Limiting
export const rateLimit = (options?: {
	requestsPerMinute?: number;
	burstLimit?: number;
	keyGenerator?: (c: any) => string;
}) =>
	createMiddleware<{
		Bindings: Env;
		Variables: { requestId: string; auth?: any };
	}>(async (c, next) => {
		const logger = createLogger({ requestId: c.get("requestId") as string });

		const requestsPerMinute =
			options?.requestsPerMinute ||
			parseInt(c.env.RATE_LIMIT_REQUESTS_PER_MINUTE) ||
			100;
		const burstLimit =
			options?.burstLimit || parseInt(c.env.RATE_LIMIT_BURST) || 20;

		// Generate rate limit key
		const key = options?.keyGenerator
			? options.keyGenerator(c)
			: generateRateLimitKey(c);

		try {
			// Try Workers Rate Limiting first (if available)
			const rateLimitResult = await checkWorkersRateLimit(
				c,
				key,
				requestsPerMinute,
				burstLimit,
			);

			// Fallback to KV-based rate limiting if Workers Rate Limiting is not available
			const result =
				rateLimitResult ||
				(await checkKVRateLimit(
					c.env.KV_CACHE,
					key,
					requestsPerMinute,
					burstLimit,
				));

			// Log rate limit check
			logger.rateLimitEvent(result.allowed, result.remaining, result.resetTime);
			metrics.recordRateLimit(result.allowed, result.remaining);

			// Set rate limit headers (always include remaining for tests)
			c.header("X-RateLimit-Limit", requestsPerMinute.toString());
			c.header(
				"X-RateLimit-Remaining",
				(result.remaining >= 0 ? result.remaining : 0).toString(),
			);
			c.header("X-RateLimit-Reset", result.resetTime.toString());

			if (!result.allowed) {
				if (result.retryAfter) {
					c.header("Retry-After", result.retryAfter.toString());
				}

				return c.json(
					{
						error: {
							code: "RATE_LIMIT_EXCEEDED",
							message: "Rate limit exceeded",
							details: {
								limit: requestsPerMinute,
								remaining: result.remaining,
								resetTime: result.resetTime,
								retryAfter: result.retryAfter,
							},
						},
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId") as string,
					},
					429,
				);
			}

			await next();
		} catch (error) {
			logger.error("Rate limiting error", error as Error);
			// Don't block requests if rate limiting fails
			await next();
		}
	});

// Generate rate limit key
function generateRateLimitKey(c: any): string {
	// Use client IP as primary identifier
	const clientIP =
		c.req.header("cf-connecting-ip") ||
		c.req.header("x-forwarded-for") ||
		"unknown";

	// Include route in the key for per-route limiting
	const route = c.req.path;

	return `rate_limit:${clientIP}:${route}`;
}

// Check Workers Rate Limiting using Cloudflare Rate Limiting binding
async function checkWorkersRateLimit(
	c: any,
	key: string,
	_limit: number,
	_burst: number,
): Promise<RateLimitResult | null> {
	// If no binding configured, signal fallback
	if (!c.env.RATE_LIMITER || typeof c.env.RATE_LIMITER.limit !== "function") {
		return null;
	}

	try {
		// Call Workers Rate Limiting binding. The binding is configured with
		// limit/period in wrangler.json, so we only pass the key.
		const { success } = await c.env.RATE_LIMITER.limit({ key });

		// The API does not expose remaining/reset; approximate reset to next minute
		const now = Date.now();
		const windowStart = Math.floor(now / 60000) * 60000;
		const resetTime = windowStart + 60000;

		return {
			allowed: success,
			// Remaining is not available from the binding; set to -1 to indicate unknown
			remaining: success ? -1 : 0,
			resetTime,
			// retryAfter is not provided; leave undefined
		};
	} catch {
		// On any error, fall back to KV-based rate limiting
		return null;
	}
}

// KV-based rate limiting using token bucket algorithm
async function checkKVRateLimit(
	kv: any,
	key: string,
	limit: number,
	burst: number,
): Promise<RateLimitResult> {
	const now = Date.now();
	const windowStart = Math.floor(now / 60000) * 60000; // 1-minute window
	const bucketKey = `${key}:${windowStart}`;

	try {
		// Get current bucket state
		const bucketData = (await kv.get(bucketKey, "json")) as {
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
			requests,
		};

		// Store with TTL of 2 minutes to clean up old buckets
		await kv.put(bucketKey, JSON.stringify(newBucketData), {
			expirationTtl: 120,
		});

		return {
			allowed,
			remaining: Math.max(0, tokens),
			resetTime: windowStart + 60000,
			retryAfter: allowed
				? undefined
				: Math.ceil((60000 - (now - windowStart)) / 1000),
		};
	} catch (error) {
		console.error("KV rate limiting error:", error);
		// Allow request if rate limiting fails
		return {
			allowed: true,
			remaining: limit,
			resetTime: windowStart + 60000,
		};
	}
}

// Per-user rate limiting
export const perUserRateLimit = (options?: {
	requestsPerMinute?: number;
	burstLimit?: number;
}) =>
	rateLimit({
		...options,
		keyGenerator: (c) => {
			const auth = c.get("auth");
			const userId =
				auth?.userId || auth?.apiKeyValid ? "api_key_user" : "anonymous";
			return `rate_limit:user:${userId}:${c.req.path}`;
		},
	});

// Per-IP rate limiting
export const perIPRateLimit = (options?: {
	requestsPerMinute?: number;
	burstLimit?: number;
}) =>
	rateLimit({
		...options,
		keyGenerator: (c) => {
			const clientIP =
				c.req.header("cf-connecting-ip") ||
				c.req.header("x-forwarded-for") ||
				"unknown";
			return `rate_limit:ip:${clientIP}:${c.req.path}`;
		},
	});

// Stricter rate limiting for expensive operations
export const strictRateLimit = () =>
	rateLimit({
		requestsPerMinute: 10,
		burstLimit: 5,
	});
