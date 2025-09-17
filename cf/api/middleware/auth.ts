import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import type { Env, AuthContext } from "#/types";
import { createLogger } from "#/utils/logger";

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
			const isValid = await validateApiKey(apiKeyHeader, c.env);
			if (isValid) {
				authContext.isAuthenticated = true;
				authContext.authenticated = true;
				authContext.apiKeyValid = true;
				authContext.role = "admin"; // API keys get admin access
				authContext.source = "api-key";
				logger.authEvent("success", "api-key");
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

// Validate API key
async function validateApiKey(apiKey: string, env: Env): Promise<boolean> {
	try {
		// Check if API key has correct prefix
		if (!env.API_KEY_PREFIX || !apiKey.startsWith(env.API_KEY_PREFIX)) {
			return false;
		}

		// In a real implementation, you might want to:
		// 1. Hash the API key and compare with stored hash
		// 2. Check API key expiration
		// 3. Rate limit per API key
		// 4. Track API key usage

		// For this implementation, we'll use a simple secret-based validation
		const expectedKey = await generateApiKey(env.API_KEY_SECRET);
		return apiKey === expectedKey;
	} catch (error) {
		console.error("API key validation error:", error);
		return false;
	}
}

// Validate JWT token
async function validateJWT(token: string, env: Env): Promise<any | null> {
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

// Generate API key (for development/testing)
async function generateApiKey(secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(secret);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `om_${hashHex.substring(0, 32)}`;
}

// Extract namespace from request (for multitenancy)
export function extractNamespace(req: any): string {
	// Try to extract from headers or subdomain
	const namespace =
		req.header?.("x-namespace") || req.header?.("x-tenant") || "default";
	return namespace;
}
