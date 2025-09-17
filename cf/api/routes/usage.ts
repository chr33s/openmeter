import { Hono } from "hono";
import { and, eq, gte, lte, sql, desc } from "drizzle-orm";
import type {
	Env,
	UsageQueryRequest,
	UsageQueryResponse,
	WindowSize,
} from "#/types";
import { UsageQuerySchema } from "#/types";
import { validate } from "#/middleware/validation";
import { requireAuth } from "#/middleware/auth";
import { withRequestLogging } from "#/utils/logger";
import { CacheService } from "#/services/cache";
import { DatabaseService } from "#/services/database";
import { events, meters } from "#/services/database";

const app = new Hono<{
	Bindings: Env;
	Variables: {
		dbService: DatabaseService;
		cacheService: CacheService;
		namespace: string;
		requestId: string;
	};
}>();

// GET /api/v1/usage/query - aggregate usage over time buckets
app.get(
	"/query",
	requireAuth(),
	validate("query", UsageQuerySchema),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const dbService = c.get("dbService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const query = c.req.valid("query") as UsageQueryRequest;

		try {
			// Group-by on arbitrary properties isn't implemented yet in this worker
			if (query.groupBy && query.groupBy.length > 0) {
				return c.json(
					{
						error: {
							code: "GROUP_BY_NOT_SUPPORTED",
							message:
								"Grouping by event properties isn't supported in this Cloudflare implementation yet.",
						},
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					400,
				);
			}

			const from = new Date(query.from);
			const to = new Date(query.to);
			const windowSize: WindowSize = (query.windowSize ?? "HOUR") as WindowSize;

			const cacheKey = CacheService.createKey(
				"usage:query",
				namespace,
				JSON.stringify({ ...query, windowSize }),
			);

			const cached = await cacheService.get<UsageQueryResponse>(cacheKey);
			if (cached) {
				logger.cacheOperation("hit", cacheKey);
				return c.json(cached);
			}
			logger.cacheOperation("miss", cacheKey);

			const database = dbService.database;

			// Determine aggregation based on meter if provided; default to SUM
			let agg: "SUM" | "COUNT" = "SUM";
			if (query.meterId) {
				try {
					const m = await database
						.select({ id: meters.id, aggregation: meters.aggregation })
						.from(meters)
						.where(and(eq(meters.id, query.meterId)))
						.limit(1);
					const aggregation = m[0]?.aggregation as string | undefined;
					if (aggregation === "COUNT") agg = "COUNT";
				} catch {
					// best-effort; fall back to SUM
				}
			}

			// Build time bucket SQL expression based on window size
			const bucketExpr = timeBucketExpr(windowSize);

			const conditions = [
				gte(events.timestamp, from),
				lte(events.timestamp, to),
			];
			if (query.meterId) conditions.push(eq(events.meterId, query.meterId));
			if (query.subjectId)
				conditions.push(eq(events.subjectId, query.subjectId));

			// Select aggregated values per bucket
			const rows = await database
				.select({
					bucket: bucketExpr,
					value:
						agg === "COUNT"
							? sql<number>`count(*)`
							: sql<number>`sum(${events.value})`,
				})
				.from(events)
				.where(and(...conditions))
				.groupBy(bucketExpr)
				.orderBy(bucketExpr);

			const data = rows.map((r) => ({
				timestamp: String((r as any).bucket),
				value: Number((r as any).value),
			}));

			const response: UsageQueryResponse = {
				meterId: query.meterId || "",
				subjectId: query.subjectId,
				from: query.from,
				to: query.to,
				windowSize,
				data,
			};

			// Cache briefly as usage changes frequently
			await cacheService.set(cacheKey, response, 60);

			logger.info("Computed usage query", {
				points: data.length,
				meterId: query.meterId,
				subjectId: query.subjectId,
				namespace,
			});

			return c.json(response);
		} catch (error) {
			logger.error("Usage query failed", error as Error);
			throw error;
		}
	},
);

// GET /api/v1/usage/report - simplified summary report
app.get(
	"/report",
	requireAuth(),
	validate("query", UsageQuerySchema.partial()),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const dbService = c.get("dbService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const q = (c.req.valid("query") || {}) as Partial<UsageQueryRequest>;

		try {
			if (q.groupBy && q.groupBy.length > 0) {
				return c.json(
					{
						error: {
							code: "GROUP_BY_NOT_SUPPORTED",
							message:
								"Grouping by event properties isn't supported in this Cloudflare implementation yet.",
						},
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					400,
				);
			}

			const from = q.from
				? new Date(q.from)
				: new Date(Date.now() - 24 * 3600 * 1000);
			const to = q.to ? new Date(q.to) : new Date();

			const cacheKey = CacheService.createKey(
				"usage:report",
				namespace,
				JSON.stringify({
					meterId: q.meterId,
					subjectId: q.subjectId,
					from: from.toISOString(),
					to: to.toISOString(),
				}),
			);

			const cached = await cacheService.get<any>(cacheKey);
			if (cached) {
				logger.cacheOperation("hit", cacheKey);
				return c.json(cached);
			}
			logger.cacheOperation("miss", cacheKey);

			const database = dbService.database;
			const conditions = [
				gte(events.timestamp, from),
				lte(events.timestamp, to),
			];
			if (q.meterId) conditions.push(eq(events.meterId, q.meterId));
			if (q.subjectId) conditions.push(eq(events.subjectId, q.subjectId));

			// Determine aggregation based on meter if provided; default to SUM
			let agg: "SUM" | "COUNT" = "SUM";
			if (q.meterId) {
				try {
					const m = await database
						.select({ id: meters.id, aggregation: meters.aggregation })
						.from(meters)
						.where(and(eq(meters.id, q.meterId)))
						.limit(1);
					const aggregation = m[0]?.aggregation as string | undefined;
					if (aggregation === "COUNT") agg = "COUNT";
				} catch {}
			}

			// Total value
			const totalRows = await database
				.select({
					value:
						agg === "COUNT"
							? sql<number>`count(*)`
							: sql<number>`sum(${events.value})`,
				})
				.from(events)
				.where(and(...conditions));

			const total = Number(totalRows?.[0]?.value ?? 0);

			// Top subjects (if meter filter present)
			const subjectRows = await database
				.select({
					subjectId: events.subjectId,
					value:
						agg === "COUNT"
							? sql<number>`count(*)`
							: sql<number>`sum(${events.value})`,
				})
				.from(events)
				.where(and(...conditions))
				.groupBy(events.subjectId)
				.orderBy(desc(sql`value`))
				.limit(10);

			const bySubject = subjectRows.map((r) => ({
				subjectId: (r as any).subjectId as string,
				value: Number((r as any).value),
			}));

			const report = {
				meterId: q.meterId || "",
				subjectId: q.subjectId,
				from: from.toISOString(),
				to: to.toISOString(),
				total,
				topSubjects: bySubject,
			};

			await cacheService.set(cacheKey, report, 60);

			logger.info("Generated usage report", {
				meterId: q.meterId,
				subjectId: q.subjectId,
				total,
				namespace,
			});

			return c.json(report);
		} catch (error) {
			logger.error("Usage report failed", error as Error);
			throw error;
		}
	},
);

// Helpers
function timeBucketExpr(windowSize: WindowSize) {
	// events.timestamp is stored as integer (ms). Convert to seconds and bucket.
	switch (windowSize) {
		case "SECOND":
			return sql`strftime('%Y-%m-%dT%H:%M:%S.000Z', datetime(${events.timestamp} / 1000, 'unixepoch'))`;
		case "MINUTE":
			return sql`strftime('%Y-%m-%dT%H:%M:00.000Z', datetime(${events.timestamp} / 1000, 'unixepoch'))`;
		case "HOUR":
			return sql`strftime('%Y-%m-%dT%H:00:00.000Z', datetime(${events.timestamp} / 1000, 'unixepoch'))`;
		case "DAY":
			return sql`strftime('%Y-%m-%dT00:00:00.000Z', datetime(${events.timestamp} / 1000, 'unixepoch'))`;
		case "MONTH":
			return sql`printf('%s-01T00:00:00.000Z', strftime('%Y-%m', datetime(${events.timestamp} / 1000, 'unixepoch')))`;
		default:
			return sql`strftime('%Y-%m-%dT%H:00:00.000Z', datetime(${events.timestamp} / 1000, 'unixepoch'))`;
	}
}

export default app;
