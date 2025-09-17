import { describe, expect, test } from "vitest";
import { SELF, env } from "cloudflare:test";
import { authHeaders } from "./helpers";

async function createCountMeter() {
	const headers = await authHeaders(env);
	const res = await SELF.fetch("http://localhost/api/v1/meters", {
		method: "POST",
		headers,
		body: JSON.stringify({
			key: `m_${crypto.randomUUID().slice(0, 8)}`,
			name: "Count Meter",
			aggregation: "COUNT",
			eventType: "count_event",
		}),
	});
	expect(res.status).toBe(201);
	return res.json();
}

describe("/api/v1/events", () => {
	test("POST single event returns 201 and creates subject if missing", async () => {
		const meter = await createCountMeter();
		const headers = await authHeaders(env);
		const idempotencyKey = crypto.randomUUID();

		const res = await SELF.fetch("http://localhost/api/v1/events", {
			method: "POST",
			headers: { ...headers, "idempotency-key": idempotencyKey },
			body: JSON.stringify({
				subject: `sub_${crypto.randomUUID().slice(0, 8)}`,
				type: meter.eventType,
				timestamp: new Date().toISOString(),
			}),
		});
		expect(res.status).toBe(201);
		const json = await res.json();
		expect(json).toHaveProperty("eventId");
		expect(json).toHaveProperty("processed", true);
		expect(json).toHaveProperty("timestamp");

		// Re-send with same idempotency key returns cached response (200)
		const res2 = await SELF.fetch("http://localhost/api/v1/events", {
			method: "POST",
			headers: { ...headers, "idempotency-key": idempotencyKey },
			body: JSON.stringify({
				subject: `sub_${crypto.randomUUID().slice(0, 8)}`,
				type: meter.eventType,
				timestamp: new Date().toISOString(),
			}),
		});
		expect(res2.status).toBe(200);
		const json2 = await res2.json();
		expect(json2.eventId).toBe(json.eventId);
		expect(json2.processed).toBe(true);
	});

	test("POST batch events supports success (201) and enforces batch size limit (400)", async () => {
		const meter = await createCountMeter();
		const headers = await authHeaders(env);
		const subject = `sub_${crypto.randomUUID().slice(0, 8)}`;

		// Small batch OK
		const ok = await SELF.fetch("http://localhost/api/v1/events/batch", {
			method: "POST",
			headers,
			body: JSON.stringify({
				events: [
					{
						subject,
						type: meter.eventType,
						timestamp: new Date().toISOString(),
					},
					{
						subject,
						type: meter.eventType,
						timestamp: new Date().toISOString(),
					},
				],
			}),
		});
		expect([201, 207]).toContain(ok.status);
		const okJson = await ok.json();
		expect(okJson).toHaveProperty("totalEvents");

		// Oversized batch rejected (fails schema validation first)
		const big = await SELF.fetch("http://localhost/api/v1/events/batch", {
			method: "POST",
			headers,
			body: JSON.stringify({
				events: Array.from({ length: 1001 }, () => ({
					subject,
					type: meter.eventType,
					timestamp: new Date().toISOString(),
				})),
			}),
		});
		expect(big.status).toBe(400);
		const bigJson = await big.json();
		expect(bigJson?.error?.code).toBe("VALIDATION_ERROR");
	});

	test("GET lists events with pagination headers and filters", async () => {
		const meter = await createCountMeter();
		const headers = await authHeaders(env);
		const subject = `sub_${crypto.randomUUID().slice(0, 8)}`;

		// Ingest a couple
		for (let i = 0; i < 3; i++) {
			const res = await SELF.fetch("http://localhost/api/v1/events", {
				method: "POST",
				headers,
				body: JSON.stringify({
					subject,
					type: meter.eventType,
					timestamp: new Date().toISOString(),
				}),
			});
			expect(res.status).toBe(201);
		}

		// Query with limit=2 and meter filter (subjectId filter expects internal subject UUID)
		const list = await SELF.fetch(
			`http://localhost/api/v1/events?limit=2&meterId=${encodeURIComponent(meter.id)}`,
			{ headers: { "x-api-key": headers["x-api-key"] } },
		);
		expect(list.status).toBe(200);
		expect(list.headers.get("x-total-count")).toBeTruthy();
		expect(list.headers.get("x-per-page")).toBe("2");
		const json = await list.json();
		expect(Array.isArray(json.data)).toBe(true);
		expect(json.totalCount).toBeGreaterThanOrEqual(3);
	});
});
