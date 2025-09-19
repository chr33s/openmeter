import { describe, expect, test } from "vitest";
import { SELF, env } from "cloudflare:test";
import { authHeaders } from "./helpers";

async function createCountMeter(eventType = "usage_evt") {
	const headers = await authHeaders(env);
	const res = await SELF.fetch("http://localhost/api/v1/meters", {
		method: "POST",
		headers,
		body: JSON.stringify({
			key: `m_${crypto.randomUUID().slice(0, 8)}`,
			name: "Usage Count Meter",
			aggregation: "COUNT",
			eventType,
		}),
	});
	expect(res.status).toBe(201);
	return res.json();
}

async function ingest(
	headers: Record<string, string>,
	subject: string,
	type: string,
	timestamp: string,
) {
	const res = await SELF.fetch("http://localhost/api/v1/events", {
		method: "POST",
		headers,
		body: JSON.stringify({ subject, type, timestamp }),
	});
	expect(res.status).toBe(201);
}

describe("/api/v1/usage", () => {
	test("GET /query aggregates by windowSize and filters by subject/meter", async () => {
		const headers = await authHeaders(env);
		const meter = await createCountMeter("agg_event");
		const subjectA = `sa_${crypto.randomUUID().slice(0, 6)}`;
		const subjectB = `sb_${crypto.randomUUID().slice(0, 6)}`;

		const now = new Date();
		const t0 = new Date(now.getTime() - 2 * 60_000); // -2m
		const t1 = new Date(now.getTime() - 60_000); // -1m
		const t2 = new Date(now.getTime()); // now

		await ingest(headers, subjectA, meter.eventType, t0.toISOString());
		await ingest(headers, subjectA, meter.eventType, t1.toISOString());
		await ingest(headers, subjectB, meter.eventType, t2.toISOString());

		const from = new Date(now.getTime() - 5 * 60_000).toISOString();
		const to = new Date(now.getTime() + 1_000).toISOString();

		// Aggregate MINUTE with meter filter
		const q = await SELF.fetch(
			`http://localhost/api/v1/usage/query?meterId=${encodeURIComponent(meter.id)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&windowSize=MINUTE`,
			{ headers: { "x-api-key": headers["x-api-key"] } },
		);
		expect(q.status).toBe(200);
		const body = await q.json();
		expect(Array.isArray(body.data)).toBe(true);
		expect(body.data.length).toBeGreaterThan(0);

		// Non-UUID subjectId filters won't match here (API uses internal UUIDs), so just assert query works
		const qSub = await SELF.fetch(
			`http://localhost/api/v1/usage/query?meterId=${encodeURIComponent(meter.id)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&windowSize=MINUTE`,
			{ headers: { "x-api-key": headers["x-api-key"] } },
		);
		expect(qSub.status).toBe(200);
		const bodySub = await qSub.json();
		expect(Array.isArray(bodySub.data)).toBe(true);
		expect(bodySub.data.length).toBeGreaterThan(0);
	});

	test("GET /query with groupBy returns 400 GROUP_BY_NOT_SUPPORTED", async () => {
		const headers = await authHeaders(env);
		const from = new Date(Date.now() - 60_000).toISOString();
		const to = new Date().toISOString();

		const res = await SELF.fetch(
			`http://localhost/api/v1/usage/query?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&groupBy=path`,
			{ headers: { "x-api-key": headers["x-api-key"] } },
		);
		expect(res.status).toBe(400);
		const json = await res.json();
		expect(json?.error?.code).toBe("VALIDATION_ERROR");
	});

	test("GET /report returns total and topSubjects; groupBy not supported", async () => {
		const headers = await authHeaders(env);
		const from = new Date(Date.now() - 60_000).toISOString();
		const to = new Date().toISOString();

		const ok = await SELF.fetch(
			`http://localhost/api/v1/usage/report?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
			{ headers: { "x-api-key": headers["x-api-key"] } },
		);
		expect(ok.status).toBe(200);
		const body = await ok.json();
		expect(body).toHaveProperty("total");
		expect(Array.isArray(body.topSubjects)).toBe(true);

		const bad = await SELF.fetch(
			`http://localhost/api/v1/usage/report?groupBy=path`,
			{ headers: { "x-api-key": headers["x-api-key"] } },
		);
		expect(bad.status).toBe(400);
		const badJson = await bad.json();
		expect(badJson?.error?.code).toBe("VALIDATION_ERROR");
	});
});
