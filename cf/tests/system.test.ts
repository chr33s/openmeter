import { describe, test, expect } from "vitest";
import { SELF } from "cloudflare:test";

describe("System endpoints", () => {
  test("GET /health returns ok or degraded with required fields", async () => {
    const res = await SELF.fetch("http://localhost/health");
    expect(res.status === 200 || res.status === 503).toBe(true);
    expect(res.headers.get("content-type") || "").toContain("application/json");
    const body = await res.json();
    expect(body).toHaveProperty("status");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("checks");
    expect(body).toHaveProperty("version");
  });

  test("GET /docs returns metadata with JSON content-type", async () => {
    const res = await SELF.fetch("http://localhost/docs");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toContain("application/json");
    const json = await res.json();
    expect(json).toHaveProperty("name");
    expect(json).toHaveProperty("version");
    expect(json).toHaveProperty("endpoints");
  });

  test("GET /metrics default JSON format with timestamp", async () => {
    const res = await SELF.fetch("http://localhost/metrics");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") || "").toContain("application/json");
    const json = await res.json();
    expect(json).toHaveProperty("timestamp");
  });

  test("GET /metrics?format=prometheus returns text with sample metric line", async () => {
    const res = await SELF.fetch("http://localhost/metrics?format=prometheus");
    expect(res.status).toBe(200);
    const ct = res.headers.get("content-type") || "";
    expect(ct).toContain("text/plain");
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    // Optional sanity: contains a HELP or TYPE or http_requests metric name
    expect(/# (HELP|TYPE)|http_requests_total/.test(text)).toBe(true);
  });
});
