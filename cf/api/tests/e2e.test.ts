import { describe, expect, test } from "vitest";
import { SELF } from "cloudflare:test";

describe("E2E: system endpoints", () => {
	test("GET /docs returns API documentation", async () => {
		const res = await SELF.fetch("http://localhost/docs");
		expect(res.status).toBe(200);

		const json = (await res.json()) as any;
		expect(json).toHaveProperty("name");
		expect(json).toHaveProperty("version");
		expect(json).toHaveProperty("endpoints");
	});

	test("GET /metrics returns JSON metrics", async () => {
		const res = await SELF.fetch("http://localhost/metrics");
		expect(res.status).toBe(200);
		const json = (await res.json()) as any;
		expect(json).toHaveProperty("timestamp");
	});

	test("GET /metrics?format=prometheus returns text", async () => {
		const res = await SELF.fetch("http://localhost/metrics?format=prometheus");
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type") || "").toContain("text/plain");
		const body = await res.text();
		expect(body.length).toBeGreaterThan(0);
	});
});

describe("E2E: CORS and errors", () => {
	test("OPTIONS /api/* returns CORS headers", async () => {
		const res = await SELF.fetch("http://localhost/api/v1/meters", {
			method: "OPTIONS",
			headers: {
				Origin: "http://localhost:3000",
				"Access-Control-Request-Method": "GET",
			},
		});
		expect(res.status).toBe(200);
		expect(
			(res.headers.get("access-control-allow-origin") || "").length,
		).toBeGreaterThan(0);
		expect(res.headers.get("access-control-allow-methods") || "").toContain(
			"GET",
		);
	});

	test("Non-existent route returns 404 with structured error", async () => {
		const res = await SELF.fetch("http://localhost/does-not-exist");
		expect(res.status).toBe(404);
		const json = (await res.json()) as any;
		expect(json?.error?.code).toBe("NOT_FOUND");
		expect(json).toHaveProperty("timestamp");
		expect(json).toHaveProperty("requestId");
	});
});

describe("E2E: auth and rate limiting", () => {
	test("Unauthenticated request to protected endpoint returns 401", async () => {
		// GET /api/v1/meters is protected; we expect auth to fail before DB access
		const res = await SELF.fetch("http://localhost/api/v1/meters");
		expect(res.status).toBe(401);
		const json = (await res.json()) as any;
		expect(json?.error?.code).toBe("UNAUTHORIZED");
	});

	test("Rate limit headers are present on responses", async () => {
		const res = await SELF.fetch("http://localhost/api/v1/meters");
		// Header names are case-insensitive; ensure they're present
		expect(Boolean(res.headers.get("x-ratelimit-limit"))).toBe(true);
		expect(Boolean(res.headers.get("x-ratelimit-remaining"))).toBe(true);
		expect(Boolean(res.headers.get("x-ratelimit-reset"))).toBe(true);
	});

	test("Content-type validation triggers before auth for events endpoint", async () => {
		// This should return 400 due to invalid content-type, regardless of auth
		const res = await SELF.fetch("http://localhost/api/v1/events", {
			method: "POST",
			headers: {
				"content-type": "text/plain",
				"x-api-key": "invalid-key",
			},
			body: "invalid data",
		});
		expect(res.status).toBe(400);
		const json = (await res.json()) as any;
		expect((json as any)?.error?.code).toBe("INVALID_CONTENT_TYPE");
	});
});

// end
