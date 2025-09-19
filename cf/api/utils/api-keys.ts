import type { Env, ApiKeyData } from "#api/types";

/**
 * Utility functions for API key management
 */

/**
 * Calculate SHA-256 hash of an API key for secure storage
 */
export async function hashApiKey(apiKey: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(apiKey);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return hashHex;
}

/**
 * Generate KV key for storing API key data
 */
export function getApiKeyStorageKey(hashedKey: string): string {
	return `ak:${hashedKey}`;
}

/**
 * Store API key data in KV
 */
export async function storeApiKey(
	env: Env,
	apiKey: string,
	data: ApiKeyData,
): Promise<void> {
	const hashedKey = await hashApiKey(apiKey);
	const storageKey = getApiKeyStorageKey(hashedKey);

	await env.KV_API_KEYS.put(storageKey, JSON.stringify(data), {
		// Optional: Set expiration if the API key has an expiry
		...(data.expiresAt && {
			expirationTtl: Math.floor(
				(new Date(data.expiresAt).getTime() - Date.now()) / 1000,
			),
		}),
	});
}

/**
 * Retrieve API key data from KV
 */
export async function getApiKeyData(
	env: Env,
	apiKey: string,
): Promise<ApiKeyData | null> {
	try {
		const hashedKey = await hashApiKey(apiKey);
		const storageKey = getApiKeyStorageKey(hashedKey);

		const result = await env.KV_API_KEYS.get(storageKey, "json");
		if (!result) {
			return null;
		}

		const data = result as ApiKeyData;

		// Check if API key has expired
		if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
			// Optionally delete expired key
			await env.KV_API_KEYS.delete(storageKey);
			return null;
		}

		return data;
	} catch (error) {
		console.error("Error retrieving API key data:", error);
		return null;
	}
}

/**
 * Update last used timestamp for an API key
 */
export async function updateApiKeyLastUsed(
	env: Env,
	apiKey: string,
): Promise<void> {
	try {
		const data = await getApiKeyData(env, apiKey);
		if (data) {
			data.lastUsedAt = new Date().toISOString();
			await storeApiKey(env, apiKey, data);
		}
	} catch (error) {
		console.error("Error updating API key last used:", error);
		// Don't throw - this is not critical for authentication
	}
}

/**
 * Validate API key format and prefix
 */
export function isValidApiKeyFormat(apiKey: string, prefix: string): boolean {
	if (!apiKey || !prefix) {
		return false;
	}

	// Check prefix
	if (!apiKey.startsWith(prefix)) {
		return false;
	}

	// Basic format validation - should be prefix + reasonable length hex string
	const keyPart = apiKey.substring(prefix.length);
	if (keyPart.length < 16 || !/^[a-f0-9]+$/i.test(keyPart)) {
		return false;
	}

	return true;
}
