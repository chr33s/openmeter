import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";

import type { Env, AuthContext, ApiKeyData } from "#api/types";
import { createLogger } from "#api/utils/logger";
import {
	getApiKeyData,
	updateApiKeyLastUsed,
	isValidApiKeyFormat,
} from "#api/utils/api-keys";

// Create authentication middleware
export const auth = () =>
	createMiddleware<{
		Bindings: Env;
		Variables: {
			auth: AuthContext;
			requestId: string;
			jwtPayload?: any;
		};
	}>(async (c, next) => {
		const requestId = (c.get("requestId") as string) || "unknown";
		const logger = createLogger({ requestId });
		const authHeader = c.req.header("Authorization");
		const apiKeyHeader = c.req.header("x-api-key");

		const authContext: AuthContext = {
			isAuthenticated: false,
			authenticated: false,
			role: "read",
			namespace: extractNamespace(c.req),
			source: "api-key",
			apiKeyValid: false,
			jwtValid: false,
		};

		// Try API key authentication first
		if (apiKeyHeader) {
			const apiKeyData = await validateApiKey(apiKeyHeader, c.env);
			if (apiKeyData) {
				authContext.isAuthenticated = true;
				authContext.authenticated = true;
				authContext.apiKeyValid = true;
				authContext.role = apiKeyData.role; // Use role from API key metadata
				authContext.source = "api-key";

				// Update last used timestamp (non-blocking)
				updateApiKeyLastUsed(c.env, apiKeyHeader).catch(console.error);

				logger.authEvent("success", "api-key", { role: apiKeyData.role });
			} else {
				logger.authEvent("failure", "api-key");
			}
		}

		// Try JWT authentication if API key failed
		if (!authContext.isAuthenticated && authHeader?.startsWith("Bearer ")) {
			const token = authHeader.substring(7);
			const jwtPayload = await validateJWT(token, c.env);

			if (jwtPayload) {
				authContext.isAuthenticated = true;
				authContext.authenticated = true;
				authContext.jwtValid = true;
				authContext.userId = jwtPayload.sub;
				authContext.role = jwtPayload.role || "read";
				authContext.source = "jwt";
				c.set("jwtPayload", jwtPayload);
				logger.authEvent("success", "jwt", { userId: jwtPayload.sub });
			} else {
				logger.authEvent("failure", "jwt");
			}
		}

		// Set auth context in request
		c.set("auth", authContext);

		await next();
	});

// Require authentication middleware
export const requireAuth = () =>
	createMiddleware<{
		Bindings: Env;
		Variables: {
			auth: AuthContext;
			requestId: string;
		};
	}>(async (c, next) => {
		const auth = c.get("auth");

		if (!auth?.isAuthenticated) {
			return c.json(
				{
					error: {
						code: "UNAUTHORIZED",
						message: "Authentication required",
					},
					timestamp: new Date().toISOString(),
					requestId: c.get("requestId") as string,
				},
				401,
			);
		}

		await next();
	});

// Require admin role middleware
export const requireAdmin = () =>
	createMiddleware<{
		Bindings: Env;
		Variables: {
			auth: AuthContext;
			requestId: string;
		};
	}>(async (c, next) => {
		const auth = c.get("auth");

		if (!auth?.isAuthenticated) {
			return c.json(
				{
					error: {
						code: "UNAUTHORIZED",
						message: "Authentication required",
					},
					timestamp: new Date().toISOString(),
					requestId: c.get("requestId") as string,
				},
				401,
			);
		}

		if (auth.role !== "admin") {
			return c.json(
				{
					error: {
						code: "FORBIDDEN",
						message: "Admin role required",
					},
					timestamp: new Date().toISOString(),
					requestId: c.get("requestId") as string,
				},
				403,
			);
		}

		await next();
	});

// Validate API key using KV-backed storage
async function validateApiKey(
	apiKey: string,
	env: Env,
): Promise<ApiKeyData | null> {
	try {
		// Early validation: check prefix format
		if (
			!env.API_KEY_PREFIX ||
			!isValidApiKeyFormat(apiKey, env.API_KEY_PREFIX)
		) {
			return null;
		}

		// Get API key data from KV storage
		const apiKeyData = await getApiKeyData(env, apiKey);
		if (!apiKeyData) {
			return null;
		}

		// Additional validation checks can be added here:
		// - Rate limiting per API key
		// - Namespace restrictions
		// - Feature flags

		return apiKeyData;
	} catch (error) {
		console.error("API key validation error:", error);
		return null;
	}
}

// Validate JWT token
async function validateJWT(token: string, env: Env): Promise<any> {
	try {
		const payload = await verify(token, env.JWT_SECRET);

		// Validate issuer and audience
		if (env.JWT_ISSUER && payload.iss !== env.JWT_ISSUER) {
			return null;
		}
		if (env.JWT_AUDIENCE && payload.aud !== env.JWT_AUDIENCE) {
			return null;
		}

		// Check expiration
		const now = Math.floor(Date.now() / 1000);
		if (payload.exp && payload.exp < now) {
			return null;
		}

		return payload;
	} catch (error) {
		console.error("JWT validation error:", error);
		return null;
	}
}

// Extract namespace from request (for multitenancy)
export function extractNamespace(req: any): string {
	// Try to extract from headers or subdomain
	const namespace =
		req.header?.("x-namespace") || req.header?.("x-tenant") || "default";
	return namespace;
}
