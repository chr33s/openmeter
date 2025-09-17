import { beforeAll, describe, expect, test } from "vitest";
import { SELF, env } from "cloudflare:test";
import { generateApiKey } from "./helpers";

async function authHeaders() {
  const key = await generateApiKey("test-secret");
  return { "x-api-key": key, "content-type": "application/json" } as Record<string, string>;
}

beforeAll(async () => {
  const db = (env as any).D1_DB as any;
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS subjects (
        id TEXT PRIMARY KEY,
        namespace TEXT NOT NULL DEFAULT 'default',
        key TEXT NOT NULL,
        display_name TEXT,
        metadata TEXT,
        stripe_customer_id TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        deleted_at INTEGER
      )`,
    )
    .run();
  await db
    .prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_subjects_namespace_key ON subjects(namespace, key)`,
    )
    .run();
});

describe("Subjects CRUD", () => {
  test("POST creates subject, GET returns it; duplicate -> 409", async () => {
    const headers = await authHeaders();
    const key = `s_${crypto.randomUUID().slice(0, 8)}`;

    const createRes = await SELF.fetch("http://localhost/api/v1/subjects", {
      method: "POST",
      headers,
      body: JSON.stringify({ key, displayName: "Alice" }),
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.key).toBe(key);

    const getRes = await SELF.fetch(`http://localhost/api/v1/subjects/${created.id}`);
    expect(getRes.status).toBe(200);

    const dupRes = await SELF.fetch("http://localhost/api/v1/subjects", {
      method: "POST",
      headers,
      body: JSON.stringify({ key }),
    });
    expect(dupRes.status).toBe(409);
    const dup = await dupRes.json();
    expect(dup?.error?.code).toBe("SUBJECT_ALREADY_EXISTS");
  });

  test("GET list supports pagination headers", async () => {
    const res = await SELF.fetch("http://localhost/api/v1/subjects?limit=1");
    expect(res.status).toBe(200);
    expect(res.headers.get("x-total-count")).toBeTruthy();
    expect(res.headers.get("x-per-page")).toBe("1");
  });

  test("PUT updates; DELETE soft-deletes; 404 for missing", async () => {
    const headers = await authHeaders();
    const create = await SELF.fetch("http://localhost/api/v1/subjects", {
      method: "POST",
      headers,
      body: JSON.stringify({ key: `s_${crypto.randomUUID().slice(0, 8)}` }),
    });
    expect(create.status).toBe(201);
    const subj = await create.json();

    const putRes = await SELF.fetch(`http://localhost/api/v1/subjects/${subj.id}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ displayName: "Bob" }),
    });
    expect(putRes.status).toBe(200);
    const updated = await putRes.json();
    expect(updated.displayName).toBe("Bob");

    const delRes = await SELF.fetch(`http://localhost/api/v1/subjects/${subj.id}`, {
      method: "DELETE",
      headers,
    });
    expect(delRes.status).toBe(200);
    const del = await delRes.json();
    expect(del).toHaveProperty("deletedAt");

    const missing = await SELF.fetch(`http://localhost/api/v1/subjects/${crypto.randomUUID()}`, {
      headers,
    });
    expect(missing.status).toBe(404);
    const mjson = await missing.json();
    expect(mjson?.error?.code).toBe("SUBJECT_NOT_FOUND");
  });
});
