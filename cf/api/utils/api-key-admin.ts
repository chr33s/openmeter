import type { Env, ApiKeyData } from "#api/types";
import { storeApiKey, getApiKeyData } from "#api/utils/api-keys";

/**
 * API Key Management utilities for development and administration
 *
 * These functions can be used to manage API keys in the KV store.
 * In a production environment, these would be exposed through a
 * secure admin interface or CLI tool.
 */

/**
 * Generate a new API key with the specified prefix
 */
export async function generateNewApiKey(
	prefix: string = "om_",
): Promise<string> {
	// Generate a secure random key
	const randomBytes = new Uint8Array(32);
	crypto.getRandomValues(randomBytes);

	// Convert to hex
	const hexKey = Array.from(randomBytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");

	return `${prefix}${hexKey}`;
}

/**
 * Create a new API key with metadata
 */
export async function createApiKey(
	env: Env,
	options: {
		role: "admin" | "read";
		description?: string;
		namespace?: string;
		expiresAt?: Date;
	},
): Promise<{ apiKey: string; data: ApiKeyData }> {
	const apiKey = await generateNewApiKey(env.API_KEY_PREFIX);

	const data: ApiKeyData = {
		role: options.role,
		createdAt: new Date().toISOString(),
		description: options.description,
		namespace: options.namespace || "default",
		...(options.expiresAt && { expiresAt: options.expiresAt.toISOString() }),
	};

	await storeApiKey(env, apiKey, data);

	return { apiKey, data };
}

/**
 * List all API keys (for admin purposes)
 * Note: This is a simplified implementation. In production, you'd want
 * pagination and more sophisticated querying.
 */
export async function listApiKeys(
	env: Env,
): Promise<Array<{ hash: string; data: ApiKeyData }>> {
	try {
		const list = await env.KV_API_KEYS.list({ prefix: "ak:" });
		const keys = [];

		for (const key of list.keys) {
			const data = (await env.KV_API_KEYS.get(key.name, "json")) as ApiKeyData;
			if (data) {
				keys.push({
					hash: key.name.substring(3), // Remove "ak:" prefix
					data,
				});
			}
		}

		return keys;
	} catch (error) {
		console.error("Error listing API keys:", error);
		return [];
	}
}

/**
 * Revoke (delete) an API key
 */
export async function revokeApiKey(env: Env, apiKey: string): Promise<boolean> {
	try {
		const data = await getApiKeyData(env, apiKey);
		if (!data) {
			return false; // API key not found
		}

		// Hash the key to get storage key
		const encoder = new TextEncoder();
		const keyData = encoder.encode(apiKey);
		const hashBuffer = await crypto.subtle.digest("SHA-256", keyData);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		const hashHex = hashArray
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
		const storageKey = `ak:${hashHex}`;

		await env.KV_API_KEYS.delete(storageKey);
		return true;
	} catch (error) {
		console.error("Error revoking API key:", error);
		return false;
	}
}

/**
 * Example usage function for setting up initial API keys
 * This could be called during deployment or setup
 */
export async function setupInitialApiKeys(env: Env): Promise<void> {
	console.log("Setting up initial API keys...");

	// Create an admin API key
	const adminKey = await createApiKey(env, {
		role: "admin",
		description: "Initial admin API key",
		namespace: "default",
	});

	console.log("Admin API key created:", adminKey.apiKey);

	// Create a read-only API key
	const readKey = await createApiKey(env, {
		role: "read",
		description: "Initial read-only API key",
		namespace: "default",
	});

	console.log("Read API key created:", readKey.apiKey);

	console.log("Initial API keys setup complete");
}
