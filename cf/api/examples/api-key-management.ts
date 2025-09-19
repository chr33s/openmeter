/**
 * API Key Management Examples
 *
 * This file demonstrates how to use the new KV-backed API key system.
 * These examples can be used in a Cloudflare Worker script or admin interface.
 */

import type { Env } from "#api/types";
import {
	createApiKey,
	listApiKeys,
	revokeApiKey,
	setupInitialApiKeys,
} from "#api/utils/api-keys";
import { getApiKeyData } from "#api/utils/api-keys";

/**
 * Example: Create a new admin API key
 */
export async function createAdminKey(env: Env): Promise<string> {
	const result = await createApiKey(env, {
		role: "admin",
		description: "Admin key for full API access",
		namespace: "default",
	});

	console.log("Created admin API key:", result.apiKey);
	console.log("Key metadata:", result.data);

	return result.apiKey;
}

/**
 * Example: Create a read-only API key with expiration
 */
export async function createReadOnlyKey(env: Env): Promise<string> {
	const expiryDate = new Date();
	expiryDate.setMonth(expiryDate.getMonth() + 3); // Expires in 3 months

	const result = await createApiKey(env, {
		role: "read",
		description: "Read-only access for analytics dashboard",
		namespace: "analytics",
		expiresAt: expiryDate,
	});

	console.log("Created read-only API key:", result.apiKey);
	console.log("Expires at:", result.data.expiresAt);

	return result.apiKey;
}

/**
 * Example: Validate an API key and check its permissions
 */
export async function validateAndCheckKey(
	env: Env,
	apiKey: string,
): Promise<void> {
	const keyData = await getApiKeyData(env, apiKey);

	if (!keyData) {
		console.log("API key is invalid or expired");
		return;
	}

	console.log("API key is valid!");
	console.log("Role:", keyData.role);
	console.log("Created:", keyData.createdAt);
	console.log("Last used:", keyData.lastUsedAt || "Never");
	console.log("Description:", keyData.description);

	if (keyData.expiresAt) {
		const expiryDate = new Date(keyData.expiresAt);
		const now = new Date();
		const daysUntilExpiry = Math.ceil(
			(expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
		);
		console.log(`Expires in ${daysUntilExpiry} days`);
	}
}

/**
 * Example: List all API keys for auditing
 */
export async function auditApiKeys(env: Env): Promise<void> {
	const keys = await listApiKeys(env);

	console.log(`Found ${keys.length} API keys:`);

	keys.forEach((key, index) => {
		console.log(
			`\n${index + 1}. API Key (hash: ${key.hash.substring(0, 8)}...)`,
		);
		console.log(`   Role: ${key.data.role}`);
		console.log(`   Created: ${key.data.createdAt}`);
		console.log(`   Description: ${key.data.description || "No description"}`);
		console.log(`   Last used: ${key.data.lastUsedAt || "Never"}`);

		if (key.data.expiresAt) {
			const expiryDate = new Date(key.data.expiresAt);
			const now = new Date();
			const isExpired = expiryDate < now;
			console.log(`   Status: ${isExpired ? "EXPIRED" : "Active"}`);
			console.log(`   Expires: ${key.data.expiresAt}`);
		} else {
			console.log(`   Status: Active (no expiration)`);
		}
	});
}

/**
 * Example: Revoke an API key
 */
export async function revokeKey(env: Env, apiKey: string): Promise<void> {
	const success = await revokeApiKey(env, apiKey);

	if (success) {
		console.log("API key revoked successfully");
	} else {
		console.log("Failed to revoke API key (may not exist)");
	}
}

/**
 * Example: Setup function for new deployments
 */
export async function setupApiKeysForNewDeployment(env: Env): Promise<void> {
	console.log("Setting up API keys for new deployment...");

	// Setup initial keys
	await setupInitialApiKeys(env);

	// Create additional specialized keys
	await createApiKey(env, {
		role: "read",
		description: "Public dashboard read access",
		namespace: "public",
	});

	await createApiKey(env, {
		role: "admin",
		description: "CI/CD deployment key",
		namespace: "deployment",
	});

	console.log("API key setup complete!");

	// Show audit
	await auditApiKeys(env);
}

/**
 * Example: Cleanup expired keys
 */
export async function cleanupExpiredKeys(env: Env): Promise<void> {
	const keys = await listApiKeys(env);
	const now = new Date();
	let cleanedCount = 0;

	for (const key of keys) {
		if (key.data.expiresAt) {
			const expiryDate = new Date(key.data.expiresAt);
			if (expiryDate < now) {
				// This is a simplified approach - in production you'd want to
				// reconstruct the original API key or store additional metadata
				console.log(
					`Found expired key: ${key.hash.substring(0, 8)}... (expired ${expiryDate.toISOString()})`,
				);
				cleanedCount++;
			}
		}
	}

	console.log(`Cleaned up ${cleanedCount} expired API keys`);
}

// Usage examples:
/*
// Create admin key
const adminKey = await createAdminKey(env);

// Validate a key
await validateAndCheckKey(env, adminKey);

// List all keys for audit
await auditApiKeys(env);

// Setup for new deployment
await setupApiKeysForNewDeployment(env);

// Cleanup expired keys
await cleanupExpiredKeys(env);
*/
