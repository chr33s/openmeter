import { describe, test, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { generateApiKey } from "./helpers";

async function authHeaders() {
	// Must match vitest.config.ts miniflare bindings
	const key = await generateApiKey("test-secret");
	return { "x-api-key": key, "content-type": "application/json" } as Record<
		string,
		string
	>;
}

describe("Meters CRUD", () => {
	beforeAll(async () => {
		// Create a minimal meters table schema required by the routes under test
		const db = (env as any).D1_DB as D1Database;
		await db
			.prepare(
				`CREATE TABLE IF NOT EXISTS meters (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL DEFAULT 'default',
        key TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        aggregation TEXT NOT NULL,
        event_type TEXT NOT NULL,
        event_from INTEGER,
        value_property TEXT,
        group_by TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
			)
			.run();
		await db
			.prepare(
				`CREATE UNIQUE INDEX IF NOT EXISTS idx_meters_namespace_key ON meters(namespace, key)`,
			)
			.run();
	});

	test("POST creates meter then GET by id returns it; duplicate key -> 409", async () => {
		const headers = await authHeaders();

		// Create
		const createRes = await SELF.fetch("http://localhost/api/v1/meters", {
			method: "POST",
			headers,
			body: JSON.stringify({
				key: `m_${crypto.randomUUID().slice(0, 8)}`,
				name: "Test Meter",
				aggregation: "COUNT",
				eventType: "test_event_type",
				groupBy: {},
			}),
		});
		expect(createRes.status).toBe(201);
		const created = await createRes.json();
		expect(created).toHaveProperty("id");

		// Get by id
		const getRes = await SELF.fetch(
			`http://localhost/api/v1/meters/${created.id}`,
			{
				headers: { "x-api-key": headers["x-api-key"] },
			},
		);
		expect(getRes.status).toBe(200);
		const got = await getRes.json();
		expect(got.id).toBe(created.id);

		// Duplicate key
		const dupRes = await SELF.fetch("http://localhost/api/v1/meters", {
			method: "POST",
			headers,
			body: JSON.stringify({
				key: created.key,
				name: "Another",
				aggregation: "COUNT",
				eventType: "test_event_type",
			}),
		});
		expect(dupRes.status).toBe(409);
		const dup = await dupRes.json();
		expect(dup?.error?.code).toBe("METER_ALREADY_EXISTS");
	});

	test("GET list meters with pagination headers", async () => {
		const headers = await authHeaders();
		const res = await SELF.fetch("http://localhost/api/v1/meters?limit=1", {
			headers,
		});
		expect(res.status).toBe(200);
		expect(res.headers.get("x-total-count")).toBeTruthy();
		expect(res.headers.get("x-page")).toBeTruthy();
		expect(res.headers.get("x-per-page")).toBe("1");
		const link = res.headers.get("link");
		if (link) expect(link).toContain("rel=");
		const json = await res.json();
		expect(Array.isArray(json.data)).toBe(true);
	});

	test("PUT updates meter; DELETE soft-deletes; 404 on missing id", async () => {
		const headers = await authHeaders();
		// Create a meter to update/delete
		const createRes = await SELF.fetch("http://localhost/api/v1/meters", {
			method: "POST",
			headers,
			body: JSON.stringify({
				key: `m_${crypto.randomUUID().slice(0, 8)}`,
				name: "To Update",
				aggregation: "COUNT",
				eventType: "upd_event",
			}),
		});
		expect(createRes.status).toBe(201);
		const created = await createRes.json();

		// Update
		const putRes = await SELF.fetch(
			`http://localhost/api/v1/meters/${created.id}`,
			{
				method: "PUT",
				headers,
				body: JSON.stringify({ name: "Updated Name" }),
			},
		);
		expect(putRes.status).toBe(200);
		const updated = await putRes.json();
		expect(updated.name).toBe("Updated Name");

		// Delete
		const delRes = await SELF.fetch(
			`http://localhost/api/v1/meters/${created.id}`,
			{ method: "DELETE", headers },
		);
		expect(delRes.status).toBe(200);
		const delJson = await delRes.json();
		expect(delJson).toHaveProperty("deletedAt");

		// 404 on missing
		const missingRes = await SELF.fetch(
			`http://localhost/api/v1/meters/${crypto.randomUUID()}`,
			{ headers },
		);
		expect(missingRes.status).toBe(404);
		const missing = await missingRes.json();
		expect(missing?.error?.code).toBe("METER_NOT_FOUND");
	});
});
