import { describe, expect, test } from "vitest";
import { SELF, env } from "cloudflare:test";
import { authHeaders, readAuthHeaders } from "./helpers";

describe("Admin enforcement and list filters", () => {
	test("meters: require admin for PUT/DELETE; 401 unauthenticated; 403 read JWT", async () => {
		const admin = await authHeaders(env);
		const read = await readAuthHeaders(env);

		// create a meter as admin
		const create = await SELF.fetch("http://localhost/api/v1/meters", {
			method: "POST",
			headers: admin,
			body: JSON.stringify({
				key: `m_${crypto.randomUUID().slice(0, 6)}`,
				name: "Admin Test",
				aggregation: "COUNT",
				eventType: "adm_evt",
			}),
		});
		expect(create.status).toBe(201);
		const meter = await create.json();

		// unauthenticated PUT
		const unauthPut = await SELF.fetch(
			`http://localhost/api/v1/meters/${meter.id}`,
			{
				method: "PUT",
				body: JSON.stringify({ name: "X" }),
				headers: { "content-type": "application/json" },
			},
		);
		expect(unauthPut.status).toBe(401);

		// read JWT PUT
		const readPut = await SELF.fetch(
			`http://localhost/api/v1/meters/${meter.id}`,
			{ method: "PUT", headers: read, body: JSON.stringify({ name: "X" }) },
		);
		expect(readPut.status).toBe(403);

		// admin PUT ok
		const adminPut = await SELF.fetch(
			`http://localhost/api/v1/meters/${meter.id}`,
			{ method: "PUT", headers: admin, body: JSON.stringify({ name: "Y" }) },
		);
		expect(adminPut.status).toBe(200);

		// unauthenticated DELETE
		const unauthDel = await SELF.fetch(
			`http://localhost/api/v1/meters/${meter.id}`,
			{ method: "DELETE" },
		);
		expect(unauthDel.status).toBe(401);

		// read JWT DELETE
		const readDel = await SELF.fetch(
			`http://localhost/api/v1/meters/${meter.id}`,
			{ method: "DELETE", headers: read },
		);
		expect(readDel.status).toBe(403);

		// admin DELETE ok
		const adminDel = await SELF.fetch(
			`http://localhost/api/v1/meters/${meter.id}`,
			{ method: "DELETE", headers: admin },
		);
		expect(adminDel.status).toBe(200);
	});

	test("subjects: list supports search and stripeCustomerId filters", async () => {
		const admin = await authHeaders(env);
		// create a few subjects
		const base = crypto.randomUUID().slice(0, 6);
		const s1 = await SELF.fetch("http://localhost/api/v1/subjects", {
			method: "POST",
			headers: admin,
			body: JSON.stringify({
				key: `s_${base}_alice`,
				displayName: "Alice",
				stripeCustomerId: `cus_${base}`,
			}),
		});
		expect(s1.status).toBe(201);
		const s2 = await SELF.fetch("http://localhost/api/v1/subjects", {
			method: "POST",
			headers: admin,
			body: JSON.stringify({ key: `s_${base}_bob`, displayName: "Bob" }),
		});
		expect(s2.status).toBe(201);

		const q1 = await SELF.fetch(
			`http://localhost/api/v1/subjects?search=${encodeURIComponent("alice")}`,
		);
		expect(q1.status).toBe(200);
		const j1 = await q1.json();
		expect(Array.isArray(j1.data)).toBe(true);
		expect(
			j1.data.find((x: any) => x.displayName?.toLowerCase() === "alice"),
		).toBeTruthy();

		const q2 = await SELF.fetch(
			`http://localhost/api/v1/subjects?stripeCustomerId=${encodeURIComponent(`cus_${base}`)}`,
		);
		expect(q2.status).toBe(200);
		const j2 = await q2.json();
		expect(j2.data.length).toBeGreaterThan(0);
	});

	test("features: list supports search and meterId filters; require admin for PUT/DELETE", async () => {
		const admin = await authHeaders(env);

		// create a meter and feature
		const meterRes = await SELF.fetch("http://localhost/api/v1/meters", {
			method: "POST",
			headers: admin,
			body: JSON.stringify({
				key: `m_${crypto.randomUUID().slice(0, 6)}`,
				name: "Feat Meter",
				aggregation: "COUNT",
				eventType: "feat_evt",
			}),
		});
		expect(meterRes.status).toBe(201);
		const meter = await meterRes.json();

		const featRes = await SELF.fetch("http://localhost/api/v1/features", {
			method: "POST",
			headers: admin,
			body: JSON.stringify({
				key: `f_${crypto.randomUUID().slice(0, 6)}`,
				name: "Searchable",
				meterId: meter.id,
			}),
		});
		expect(featRes.status).toBe(201);
		const feature = await featRes.json();

		const search = await SELF.fetch(
			`http://localhost/api/v1/features?search=${encodeURIComponent("search")}`,
		);
		expect(search.status).toBe(200);
		const js = await search.json();
		expect(Array.isArray(js.data)).toBe(true);

		const byMeter = await SELF.fetch(
			`http://localhost/api/v1/features?meterId=${encodeURIComponent(meter.id)}`,
		);
		expect(byMeter.status).toBe(200);
		const jm = await byMeter.json();
		expect(jm.data.find((x: any) => x.meterId === meter.id)).toBeTruthy();

		// admin required for PUT/DELETE confirmed by existing CRUD tests; just smoke-check PUT forbidden paths
		const read = await readAuthHeaders(env);
		const readPut = await SELF.fetch(
			`http://localhost/api/v1/features/${feature.id}`,
			{ method: "PUT", headers: read, body: JSON.stringify({ name: "Nope" }) },
		);
		expect(readPut.status).toBe(403);
	});
});
