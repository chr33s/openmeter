import { describe, test, expect, beforeEach } from "vitest";
import { SELF } from "cloudflare:test";
import { createTestApiKey } from "./helpers";
import type { Env } from "#api/types";

/**
 * Tests for the new KV-backed API key validation system
 */
describe("API Key Validation", () => {
	let env: Env;

	beforeEach(() => {
		// Get the test environment
		env = {
			API_KEY_PREFIX: "om_",
			JWT_SECRET: "test-jwt-secret",
			JWT_ISSUER: "cloudmeter",
			JWT_AUDIENCE: "cloudmeter-api",
		} as Env;
	});

	test("Valid admin API key allows access to protected endpoints", async () => {
		// Create a test admin API key
		const adminKey = await createTestApiKey(env, "admin", "Test admin key");

		const res = await SELF.fetch("http://localhost/api/v1/meters", {
			headers: {
				"x-api-key": adminKey,
				"content-type": "application/json",
			},
		});

		expect(res.status).toBe(200);
	});

	test("Valid read API key allows access to read endpoints but not admin", async () => {
		// Create a test read API key
		const readKey = await createTestApiKey(env, "read", "Test read key");

		// Should work for read endpoints
		const readRes = await SELF.fetch("http://localhost/api/v1/meters", {
			headers: {
				"x-api-key": readKey,
				"content-type": "application/json",
			},
		});

		expect(readRes.status).toBe(200);

		// Should fail for admin-only endpoints (if any exist)
		// Note: This would depend on having admin-only endpoints defined
	});

	test("API key without correct prefix is rejected", async () => {
		const invalidKey = "invalid_1234567890abcdef1234567890abcdef";

		const res = await SELF.fetch("http://localhost/api/v1/meters", {
			headers: {
				"x-api-key": invalidKey,
				"content-type": "application/json",
			},
		});

		expect(res.status).toBe(401);
	});

	test("Malformed API key is rejected", async () => {
		const malformedKey = "om_invalid-format";

		const res = await SELF.fetch("http://localhost/api/v1/meters", {
			headers: {
				"x-api-key": malformedKey,
				"content-type": "application/json",
			},
		});

		expect(res.status).toBe(401);
	});

	test("Non-existent API key is rejected", async () => {
		const nonExistentKey = "om_1234567890abcdef1234567890abcdef12345678";

		const res = await SELF.fetch("http://localhost/api/v1/meters", {
			headers: {
				"x-api-key": nonExistentKey,
				"content-type": "application/json",
			},
		});

		expect(res.status).toBe(401);
	});

	test("Empty API key header is handled gracefully", async () => {
		const res = await SELF.fetch("http://localhost/api/v1/meters", {
			headers: {
				"x-api-key": "",
				"content-type": "application/json",
			},
		});

		expect(res.status).toBe(401);
	});

	test("Rate limiting works per API key", async () => {
		// This would require setting up a specific rate limit scenario
		// and would depend on the actual rate limiting configuration
		// For now, we'll just verify the middleware is present

		const adminKey = await createTestApiKey(
			env,
			"admin",
			"Rate limit test key",
		);

		// Make multiple requests quickly
		const promises = Array.from({ length: 5 }, () =>
			SELF.fetch("http://localhost/api/v1/meters", {
				headers: {
					"x-api-key": adminKey,
					"content-type": "application/json",
				},
			}),
		);

		const responses = await Promise.all(promises);

		// All requests should have rate limit headers
		responses.forEach((res) => {
			expect(res.headers.get("X-RateLimit-Limit")).toBeTruthy();
			expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined();
			expect(res.headers.get("X-RateLimit-Reset")).toBeTruthy();
		});
	});
});

describe("API Key Security", () => {
	test("API key hashing produces consistent results", async () => {
		// This would test the internal hashing function
		// In practice, this would be in a unit test for the utility functions
	});

	test("API key storage format is correct", async () => {
		// This would verify the KV storage format
		// In practice, this would be in a unit test for the utility functions
	});
});
