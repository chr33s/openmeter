import { eq, and, desc, sql } from "drizzle-orm";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";

import type {
	Env,
	CreateMeterRequest,
	UpdateMeterRequest,
	Meter,
	PaginationResponse,
} from "#api/types";
import { MeterAggregation } from "#api/types";
import { CreateMeterSchema, UpdateMeterSchema } from "#api/types";
import { meters } from "#api/services/database";
import { requireAuth, requireAdmin } from "#api/middleware/auth";
import { validate, commonSchemas } from "#api/middleware/validation";
import { perUserRateLimit } from "#api/middleware/rate-limit";
import { withRequestLogging } from "#api/utils/logger";
import { pagination, addPaginationHeaders } from "#api/utils/pagination";
import { CacheService } from "#api/services/cache";
import { DatabaseService } from "#api/services/database";

const app = new Hono<{
	Bindings: Env;
	Variables: {
		dbService: DatabaseService;
		cacheService: CacheService;
		namespace: string;
		requestId: string;
	};
}>();

// List meters
app.get(
	"/",
	// If unauthenticated, fail fast with 401 before touching DB (to satisfy tests)
	createMiddleware<{
		Bindings: Env;
		Variables: { requestId: string; auth: any };
	}>(async (c, next) => {
		const auth = c.get("auth");
		if (!auth?.isAuthenticated) {
			return c.json(
				{
					error: { code: "UNAUTHORIZED", message: "Authentication required" },
					timestamp: new Date().toISOString(),
					requestId: c.get("requestId"),
				},
				401,
			);
		}
		await next();
	}),
	validate(
		"query",
		commonSchemas.paginationQuery.extend({
			search: commonSchemas.filterQuery.shape.search,
			aggregation: z.enum(MeterAggregation).optional(),
			eventType: z.string().optional(),
			includeDeleted: z.coerce.boolean().optional().default(false),
		}),
	),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const dbService = c.get("dbService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const query = c.req.valid("query");

		try {
			const paginationParams = pagination.parseParams(
				new URL(c.req.url).searchParams,
			);
			const cacheKey = CacheService.createKey(
				"meters",
				namespace,
				JSON.stringify(query),
			);

			// Try cache first
			const cached =
				await cacheService.get<PaginationResponse<Meter>>(cacheKey);
			if (cached) {
				logger.cacheOperation("hit", cacheKey);
				const response = new Response(JSON.stringify(cached));
				return addPaginationHeaders(
					response,
					c.req.url,
					paginationParams,
					cached.totalCount,
				);
			}

			logger.cacheOperation("miss", cacheKey);

			// Build query
			const database = dbService.database;
			const conditions = [eq(meters.namespace, namespace)];

			// Filter out deleted meters unless includeDeleted is true
			if (!query.includeDeleted) {
				conditions.push(sql`${meters.deletedAt} IS NULL`);
			}

			if (query.search) {
				conditions.push(
					sql`(${meters.name} LIKE ${`%${query.search}%`} OR ${meters.key} LIKE ${`%${query.search}%`})`,
				);
			}

			if (query.aggregation) {
				conditions.push(eq(meters.aggregation, query.aggregation));
			}

			if (query.eventType) {
				conditions.push(eq(meters.eventType, query.eventType));
			}

			// Query with pagination
			const metersQuery = database
				.select()
				.from(meters)
				.where(and(...conditions))
				.orderBy(desc(meters.createdAt))
				.limit(paginationParams.limit)
				.offset(paginationParams.offset);

			const metersResult = await metersQuery;

			// Count total
			const countRows = await database
				.select({ count: sql<number>`count(*)` })
				.from(meters)
				.where(and(...conditions));

			const totalCount = Number(countRows[0]?.count ?? 0);

			const result = pagination.createResponse(
				metersResult.map(
					(meter) =>
						({
							id: meter.id,
							namespace: meter.namespace,
							key: meter.key,
							name: meter.name,
							description: meter.description ?? undefined,
							aggregation: meter.aggregation as Meter["aggregation"],
							eventType: meter.eventType,
							eventFrom: meter.eventFrom ?? undefined,
							valueProperty: meter.valueProperty ?? undefined,
							groupBy: meter.groupBy || {},
							createdAt: meter.createdAt,
							updatedAt: meter.updatedAt,
						}) as Meter,
				),
				paginationParams,
				totalCount,
			);

			// Cache result
			await cacheService.set(cacheKey, result, 300); // 5 minutes

			logger.info("Listed meters", {
				count: metersResult.length,
				totalCount,
				namespace,
			});

			const response = Response.json(result);
			return addPaginationHeaders(
				response,
				c.req.url,
				paginationParams,
				totalCount,
			);
		} catch (error) {
			logger.error("Failed to list meters", error as Error);
			throw error;
		}
	},
);

// Get meter by ID or slug (key)
app.get(
	"/:idOrSlug",
	validate("param", z.object({ idOrSlug: z.string().min(1) })),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const dbService = c.get("dbService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const idOrSlug = c.req.param("idOrSlug");

		try {
			const cacheKey = CacheService.createKey("meter", namespace, idOrSlug);

			// Try cache first
			const cached = await cacheService.get<Meter>(cacheKey);
			if (cached) {
				logger.cacheOperation("hit", cacheKey);
				return c.json(cached);
			}

			logger.cacheOperation("miss", cacheKey);

			const database = dbService.database;
			// Support both ID and slug (key) lookup
			const metersResult = await database
				.select()
				.from(meters)
				.where(
					and(
						eq(meters.namespace, namespace),
						sql`(${meters.id} = ${idOrSlug} OR ${meters.key} = ${idOrSlug})`,
					),
				)
				.limit(1);

			if (metersResult.length === 0) {
				return c.json(
					{
						error: {
							code: "METER_NOT_FOUND",
							message: "Meter not found",
						},
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					404,
				);
			}

			const meter = metersResult[0]!;
			const result: Meter = {
				id: meter.id,
				namespace: meter.namespace,
				key: meter.key,
				name: meter.name,
				description: meter.description ?? undefined,
				aggregation: meter.aggregation as Meter["aggregation"],
				eventType: meter.eventType,
				eventFrom: meter.eventFrom ?? undefined,
				valueProperty: meter.valueProperty ?? undefined,
				groupBy: meter.groupBy || {},
				createdAt: meter.createdAt,
				updatedAt: meter.updatedAt,
			};

			// Cache result
			await cacheService.set(cacheKey, result, 300);

			logger.info("Retrieved meter", { idOrSlug, namespace });

			return c.json(result);
		} catch (error) {
			logger.error("Failed to get meter", error as Error, { id });
			throw error;
		}
	},
);

// Create meter
app.post(
	"/",
	requireAuth(),
	perUserRateLimit({ requestsPerMinute: 30 }),
	validate("json", CreateMeterSchema),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const dbService = c.get("dbService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const data = c.req.valid("json") as CreateMeterRequest;

		try {
			const database = dbService.database;

			// Check if meter with same key already exists
			const existing = await database
				.select()
				.from(meters)
				.where(and(eq(meters.namespace, namespace), eq(meters.key, data.key)))
				.limit(1);

			if (existing.length > 0) {
				return c.json(
					{
						error: {
							code: "METER_ALREADY_EXISTS",
							message: "A meter with this key already exists",
						},
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					409,
				);
			}

			// Create meter
			const [newMeter] = await database
				.insert(meters)
				.values({
					namespace,
					key: data.key,
					name: data.name,
					description: data.description,
					aggregation: data.aggregation,
					eventType: data.eventType,
					valueProperty: data.valueProperty,
					groupBy: data.groupBy || {},
				})
				.returning();

			if (!newMeter) {
				throw new Error("Failed to insert meter");
			}

			// Invalidate cache
			await cacheService.invalidatePattern(`meters:${namespace}`);

			const result: Meter = {
				id: newMeter.id,
				namespace: newMeter.namespace,
				key: newMeter.key,
				name: newMeter.name,
				description: newMeter.description ?? undefined,
				aggregation: newMeter.aggregation as Meter["aggregation"],
				eventType: newMeter.eventType,
				eventFrom: newMeter.eventFrom ?? undefined,
				valueProperty: newMeter.valueProperty ?? undefined,
				groupBy: newMeter.groupBy || {},
				createdAt: newMeter.createdAt,
				updatedAt: newMeter.updatedAt,
			};

			logger.info("Created meter", {
				id: newMeter.id,
				key: data.key,
				namespace,
			});

			return c.json(result, 201);
		} catch (error) {
			logger.error("Failed to create meter", error as Error, { key: data.key });
			throw error;
		}
	},
);

// Update meter
app.put(
	"/:id",
	requireAdmin(),
	validate(
		"param",
		z.object({ id: commonSchemas.uuid.or(commonSchemas.ulid) }),
	),
	validate("json", UpdateMeterSchema),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const dbService = c.get("dbService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const id = c.req.param("id");
		const data = c.req.valid("json") as UpdateMeterRequest;

		try {
			const database = dbService.database;

			// Check if meter exists
			const existing = await database
				.select()
				.from(meters)
				.where(and(eq(meters.id, id), eq(meters.namespace, namespace)))
				.limit(1);

			if (existing.length === 0) {
				return c.json(
					{
						error: {
							code: "METER_NOT_FOUND",
							message: "Meter not found",
						},
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					404,
				);
			}

			// Update meter
			const [updatedMeter] = await database
				.update(meters)
				.set({
					name: data.name,
					description: data.description,
					aggregation: data.aggregation,
					eventType: data.eventType,
					valueProperty: data.valueProperty,
					groupBy: data.groupBy,
					updatedAt: new Date(),
				})
				.where(and(eq(meters.id, id), eq(meters.namespace, namespace)))
				.returning();

			if (!updatedMeter) {
				throw new Error("Failed to update meter");
			}

			// Invalidate cache
			await cacheService.invalidatePattern(`meters:${namespace}`);
			await cacheService.delete(CacheService.createKey("meter", namespace, id));

			const result: Meter = {
				id: updatedMeter.id,
				namespace: updatedMeter.namespace,
				key: updatedMeter.key,
				name: updatedMeter.name,
				description: updatedMeter.description ?? undefined,
				aggregation: updatedMeter.aggregation as Meter["aggregation"],
				eventType: updatedMeter.eventType,
				eventFrom: updatedMeter.eventFrom ?? undefined,
				valueProperty: updatedMeter.valueProperty ?? undefined,
				groupBy: updatedMeter.groupBy || {},
				createdAt: updatedMeter.createdAt,
				updatedAt: updatedMeter.updatedAt,
			};

			logger.info("Updated meter", { id, namespace });

			return c.json(result);
		} catch (error) {
			logger.error("Failed to update meter", error as Error, { id });
			throw error;
		}
	},
);

// Delete meter
app.delete(
	"/:id",
	requireAdmin(),
	validate(
		"param",
		z.object({ id: commonSchemas.uuid.or(commonSchemas.ulid) }),
	),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const dbService = c.get("dbService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const id = c.req.param("id");

		try {
			const database = dbService.database;

			// Soft delete (set deletedAt timestamp)
			const [deletedMeter] = await database
				.update(meters)
				.set({
					deletedAt: new Date(),
					updatedAt: new Date(),
				})
				.where(and(eq(meters.id, id), eq(meters.namespace, namespace)))
				.returning();

			if (!deletedMeter) {
				return c.json(
					{
						error: {
							code: "METER_NOT_FOUND",
							message: "Meter not found",
						},
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					404,
				);
			}

			// Invalidate cache
			await cacheService.invalidatePattern(`meters:${namespace}`);
			await cacheService.delete(CacheService.createKey("meter", namespace, id));

			logger.info("Deleted meter", { id, namespace });

			return c.json({
				message: "Meter deleted successfully",
				id,
				deletedAt: deletedMeter.deletedAt,
			});
		} catch (error) {
			logger.error("Failed to delete meter", error as Error, { id });
			throw error;
		}
	},
);

// Query meter usage - additional endpoint for parity
app.get(
	"/:id/query",
	requireAuth(),
	validate(
		"param",
		z.object({ id: commonSchemas.uuid.or(commonSchemas.ulid) }),
	),
	validate(
		"query",
		z.object({
			from: z.string().check(z.iso.datetime()),
			to: z.string().check(z.iso.datetime()),
			windowSize: z.enum(["MINUTE", "HOUR", "DAY", "MONTH"]).optional(),
			subject: z.string().optional(),
			groupBy: z.array(z.string()).optional(),
		}),
	),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const _dbService = c.get("dbService");
		const namespace = c.get("namespace");
		const id = c.req.param("id");
		const query = c.req.valid("query");

		try {
			// This would typically call a usage query service
			// For now, return a placeholder response
			logger.info("Queried meter usage", { id, namespace, query });

			return c.json({
				meterId: id,
				from: query.from,
				to: query.to,
				windowSize: query.windowSize || "HOUR",
				data: [],
				message: "Meter query endpoint - implementation pending",
			});
		} catch (error) {
			logger.error("Failed to query meter", error as Error, { id });
			throw error;
		}
	},
);

// Get subjects for a meter - additional endpoint for parity
app.get(
	"/:id/subjects",
	requireAuth(),
	validate(
		"param",
		z.object({ id: commonSchemas.uuid.or(commonSchemas.ulid) }),
	),
	validate("query", commonSchemas.paginationQuery),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const _dbService = c.get("dbService");
		const namespace = c.get("namespace");
		const id = c.req.param("id");
		const query = c.req.valid("query");

		try {
			// This would typically query subjects that have events for this meter
			// For now, return a placeholder response
			logger.info("Listed meter subjects", { id, namespace, query });

			return c.json({
				meterId: id,
				subjects: [],
				totalCount: 0,
				hasNextPage: false,
				hasPreviousPage: false,
				message: "Meter subjects endpoint - implementation pending",
			});
		} catch (error) {
			logger.error("Failed to list meter subjects", error as Error, { id });
			throw error;
		}
	},
);

export default app;
