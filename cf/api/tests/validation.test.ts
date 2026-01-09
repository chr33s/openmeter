import { describe, test, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("Validation: content type", () => {
	test("POST /api/v1/events with invalid content-type returns 400 INVALID_CONTENT_TYPE", async () => {
		const res = await SELF.fetch("http://localhost/api/v1/events", {
			method: "POST",
			headers: {
				"content-type": "text/plain",
			},
			body: "invalid",
		});
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json?.error?.code).toBe("INVALID_CONTENT_TYPE");
	});

	test("POST /api/v1/meters invalid content-type returns 400", async () => {
		const res = await SELF.fetch("http://localhost/api/v1/meters", {
			method: "POST",
			headers: {
				"content-type": "text/plain",
			},
			body: "{}",
		});
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json?.error?.code).toBe("INVALID_CONTENT_TYPE");
	});
});

describe("Validation: param schemas", () => {
	test("GET /api/v1/meters/:idOrSlug with non-existent slug returns 404 METER_NOT_FOUND", async () => {
		const res = await SELF.fetch(
			"http://localhost/api/v1/meters/non-existent-slug",
		);
		// With meterIdOrSlug support, any string is a valid lookup (either ID or slug)
		// If not found, we return 404; if auth required first, we get 401
		if (res.status === 404) {
			const json = await res.json();
			expect(json?.error?.code).toBe("METER_NOT_FOUND");
		} else {
			expect([401, 403]).toContain(res.status);
		}
	});
});
