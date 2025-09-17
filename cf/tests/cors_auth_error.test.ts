import { describe, test, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("CORS", () => {
	test("OPTIONS /api/* returns CORS headers and 200", async () => {
		const res = await SELF.fetch("http://localhost/api/v1/meters", {
			method: "OPTIONS",
			headers: {
				Origin: "http://localhost:3000",
				"Access-Control-Request-Method": "GET",
				"Access-Control-Request-Headers":
					"content-type, authorization, x-api-key, idempotency-key",
			},
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
		expect(res.headers.get("access-control-allow-methods") || "").toContain(
			"GET",
		);
		const allowHeaders = res.headers.get("access-control-allow-headers") || "";
		expect(allowHeaders.toLowerCase()).toContain("content-type");
		expect(allowHeaders.toLowerCase()).toContain("authorization");
		expect(allowHeaders.toLowerCase()).toContain("x-api-key");
		expect(allowHeaders.toLowerCase()).toContain("idempotency-key");
	});
});

describe("Authentication and rate limits", () => {
	test("Unauthenticated GET to protected endpoint returns 401 with error shape", async () => {
		const res = await SELF.fetch("http://localhost/api/v1/meters");
		expect(res.status).toBe(401);
		expect(res.headers.get("content-type") || "").toContain("application/json");
		const json = await res.json();
		expect(json?.error?.code).toBe("UNAUTHORIZED");
		expect(json).toHaveProperty("timestamp");
		expect(json).toHaveProperty("requestId");
	});

	test("Responses include rate limit headers even on 401", async () => {
		const res = await SELF.fetch("http://localhost/api/v1/meters");
		expect(Boolean(res.headers.get("x-ratelimit-limit"))).toBe(true);
		expect(Boolean(res.headers.get("x-ratelimit-remaining"))).toBe(true);
		expect(Boolean(res.headers.get("x-ratelimit-reset"))).toBe(true);
	});
});

describe("Error handling", () => {
	test("Unknown route returns structured 404", async () => {
		const res = await SELF.fetch("http://localhost/does-not-exist");
		expect(res.status).toBe(404);
		const json = await res.json();
		expect(json?.error?.code).toBe("NOT_FOUND");
		expect(json).toHaveProperty("timestamp");
		expect(json).toHaveProperty("requestId");
	});
});
