import type { Env, CacheEntry } from "#api/types";

export class CacheService {
	private kv: KVNamespace;
	private defaultTTL: number;

	constructor(kv: KVNamespace, defaultTTL: number = 300) {
		this.kv = kv;
		this.defaultTTL = defaultTTL;
	}

	// Get cache entry
	async get<T>(key: string): Promise<T | null> {
		try {
			const cached = (await this.kv.get(key, "json")) as CacheEntry<T> | null;

			if (!cached) {
				return null;
			}

			// Check if expired
			const now = Date.now();
			if (
				cached.timestamp &&
				cached.ttl &&
				now > cached.timestamp + cached.ttl * 1000
			) {
				await this.delete(key);
				return null;
			}

			return cached.data || cached.value;
		} catch (error) {
			console.error("Cache get error:", error);
			return null;
		}
	}

	// Set cache entry
	async set<T>(key: string, data: T, ttl?: number): Promise<void> {
		try {
			const entry: CacheEntry<T> = {
				value: data,
				data,
				timestamp: Date.now(),
				ttl: ttl || this.defaultTTL,
			};

			await this.kv.put(key, JSON.stringify(entry), {
				expirationTtl: ttl || this.defaultTTL,
			});
		} catch (error) {
			console.error("Cache set error:", error);
			// Don't throw - cache failures shouldn't break the API
		}
	}

	// Delete cache entry
	async delete(key: string): Promise<void> {
		try {
			await this.kv.delete(key);
		} catch (error) {
			console.error("Cache delete error:", error);
		}
	}

	// Generate cache key
	static createKey(prefix: string, ...parts: string[]): string {
		return `${prefix}:${parts.join(":")}`;
	}

	// Cache with getter function
	async getOrSet<T>(
		key: string,
		getter: () => Promise<T>,
		ttl?: number,
	): Promise<T> {
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		const data = await getter();
		await this.set(key, data, ttl);
		return data;
	}

	// Invalidate cache by pattern (prefix)
	async invalidatePattern(prefix: string): Promise<void> {
		try {
			// KV doesn't support pattern deletion, so we need to track keys
			// This is a simplified approach - in production you might want
			// to maintain a separate index of cache keys
			const listResult = await this.kv.list({ prefix });

			for (const key of listResult.keys) {
				await this.delete(key.name);
			}
		} catch (error) {
			console.error("Cache pattern invalidation error:", error);
		}
	}

	// Health check
	async healthCheck(): Promise<boolean> {
		try {
			const testKey = "health-check";
			// Use minimum TTL of 60 seconds to satisfy KV requirements
			await this.set(testKey, "test", 60);
			const result = await this.get(testKey);
			await this.delete(testKey);
			return result === "test";
		} catch (error) {
			console.error("Cache health check failed:", error);
			return false;
		}
	}
}

export function createCacheService(env: Env): CacheService {
	const ttl = parseInt(env.CACHE_TTL_SECONDS) || 300;
	return new CacheService(env.KV_CACHE, ttl);
}
