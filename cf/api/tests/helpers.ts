import type { Env, ApiKeyData } from "#api/types";
import { storeApiKey } from "#api/utils/api-keys";

export async function generateApiKey(secret: string) {
	const enc = new TextEncoder();
	const data = enc.encode(secret);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `om_${hashHex.substring(0, 32)}`;
}

/**
 * Create a test API key and store it in KV
 */
export async function createTestApiKey(
	env: Env,
	role: "admin" | "read" = "admin",
	description?: string,
): Promise<string> {
	const apiKey = await generateApiKey(
		`test-secret-${Date.now()}-${Math.random()}`,
	);

	const apiKeyData: ApiKeyData = {
		role,
		createdAt: new Date().toISOString(),
		description: description || `Test API key with ${role} role`,
		namespace: "default",
	};

	// Store in KV
	await storeApiKey(env, apiKey, apiKeyData);

	return apiKey;
}

export async function authHeaders(env: Env, role: "admin" | "read" = "admin") {
	const key = await createTestApiKey(env, role);
	return { "x-api-key": key, "content-type": "application/json" } as Record<
		string,
		string
	>;
}

// Generate a minimal HS256 JWT for tests
export async function generateJwt(env: Env, role: "read" | "admin" = "read") {
	const header = { alg: "HS256", typ: "JWT" };
	const now = Math.floor(Date.now() / 1000);
	const payload: any = {
		iss: env.JWT_ISSUER || "openmeter",
		aud: env.JWT_AUDIENCE || "openmeter-api",
		iat: now,
		exp: now + 60 * 5,
		sub: "user-test",
		role,
	};

	const enc = (obj: any) =>
		btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))
			.replace(/=+$/g, "")
			.replace(/\+/g, "-")
			.replace(/\//g, "_");

	const data = `${enc(header)}.${enc(payload)}`;

	const keyData = new TextEncoder().encode(env.JWT_SECRET || "test-jwt");
	const cryptoKey = await crypto.subtle.importKey(
		"raw",
		keyData,
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = new Uint8Array(
		await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data)),
	);
	const sigB64 = btoa(String.fromCharCode(...sig))
		.replace(/=+$/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

	return `${data}.${sigB64}`;
}

export async function readAuthHeaders(env: Env) {
	const jwt = await generateJwt(env, "read");
	return {
		Authorization: `Bearer ${jwt}`,
		"content-type": "application/json",
	} as Record<string, string>;
}

/**
 * Create read-only API key headers for testing
 */
export async function readApiKeyHeaders(env: Env) {
	const key = await createTestApiKey(env, "read", "Test read API key");
	return { "x-api-key": key, "content-type": "application/json" } as Record<
		string,
		string
	>;
}
