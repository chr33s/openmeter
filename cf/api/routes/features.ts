import { eq, and, desc, sql, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";

import type {
	Env,
	Feature,
	CreateFeatureRequest,
	UpdateFeatureRequest,
	PaginationResponse,
} from "#api/types";
import { CreateFeatureSchema, UpdateFeatureSchema } from "#api/types";
import { features, meters } from "#api/services/database";
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

// List features
app.get(
	"/",
	validate(
		"query",
		commonSchemas.paginationQuery.extend({
			search: commonSchemas.filterQuery.shape.search,
			meterId: z.string().optional(),
			includeArchived: z.coerce.boolean().optional().default(false),
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
				"features",
				namespace,
				JSON.stringify(query),
			);

			const cached =
				await cacheService.get<PaginationResponse<Feature>>(cacheKey);
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

			const database = dbService.database;
			const conditions = [eq(features.namespace, namespace)];

			// Filter out archived (deleted) features unless includeArchived is true
			if (!query.includeArchived) {
				conditions.push(sql`${features.deletedAt} IS NULL`);
			}

			if (query.search) {
				conditions.push(
					sql`(${features.name} LIKE ${`%${query.search}%`} OR ${features.key} LIKE ${`%${query.search}%`})`,
				);
			}

			if (query.meterId) {
				conditions.push(eq(features.meterId, query.meterId));
			}

			const rows = await database
				.select()
				.from(features)
				.where(and(...conditions))
				.orderBy(desc(features.createdAt))
				.limit(paginationParams.limit)
				.offset(paginationParams.offset);

			const countRows = await database
				.select({ count: sql<number>`count(*)` })
				.from(features)
				.where(and(...conditions));

			const totalCount = Number(countRows[0]?.count ?? 0);

			const result = pagination.createResponse(
				rows.map(
					(f) =>
						({
							id: f.id,
							namespace: f.namespace,
							key: f.key,
							name: f.name,
							description: f.description ?? undefined,
							meterId: f.meterId ?? undefined,
							createdAt: f.createdAt,
							updatedAt: f.updatedAt,
							deletedAt: f.deletedAt ?? undefined,
						}) as Feature,
				),
				paginationParams,
				totalCount,
			);

			await cacheService.set(cacheKey, result, 300);

			logger.info("Listed features", {
				count: rows.length,
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
			logger.error("Failed to list features", error as Error);
			throw error;
		}
	},
);

// Get feature by ID
app.get(
	"/:id",
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
			const cacheKey = CacheService.createKey("feature", namespace, id);
			const cached = await cacheService.get<Feature>(cacheKey);
			if (cached) {
				logger.cacheOperation("hit", cacheKey);
				return c.json(cached);
			}

			logger.cacheOperation("miss", cacheKey);

			const database = dbService.database;
			const rows = await database
				.select()
				.from(features)
				.where(and(eq(features.id, id), eq(features.namespace, namespace)))
				.limit(1);

			if (rows.length === 0) {
				return c.json(
					{
						error: { code: "FEATURE_NOT_FOUND", message: "Feature not found" },
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					404,
				);
			}

			const f = rows[0]!;
			const result: Feature = {
				id: f.id,
				namespace: f.namespace,
				key: f.key,
				name: f.name,
				description: f.description ?? undefined,
				meterId: f.meterId ?? undefined,
				createdAt: f.createdAt,
				updatedAt: f.updatedAt,
				deletedAt: f.deletedAt ?? undefined,
			};

			await cacheService.set(cacheKey, result, 300);
			logger.info("Retrieved feature", { id, namespace });
			return c.json(result);
		} catch (error) {
			logger.error("Failed to get feature", error as Error, { id });
			throw error;
		}
	},
);

// Create feature
app.post(
	"/",
	requireAuth(),
	perUserRateLimit({ requestsPerMinute: 30 }),
	validate("json", CreateFeatureSchema),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const dbService = c.get("dbService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const data = c.req.valid("json") as CreateFeatureRequest;

		try {
			const database = dbService.database;

			// Validate that the meter exists and is not deleted if meterId is provided
			if (data.meterId) {
				const meterResult = await database
					.select()
					.from(meters)
					.where(
						and(
							eq(meters.id, data.meterId),
							eq(meters.namespace, namespace),
							isNull(meters.deletedAt),
						),
					)
					.limit(1);

				if (meterResult.length === 0) {
					return c.json(
						{
							error: {
								code: "METER_NOT_FOUND",
								message: "The specified meter does not exist or is archived",
							},
							timestamp: new Date().toISOString(),
							requestId: c.get("requestId"),
						},
						400,
					);
				}
			}

			// Check for existing key
			const existing = await database
				.select()
				.from(features)
				.where(
					and(eq(features.namespace, namespace), eq(features.key, data.key)),
				)
				.limit(1);

			if (existing.length > 0) {
				return c.json(
					{
						error: {
							code: "FEATURE_ALREADY_EXISTS",
							message: "A feature with this key already exists",
						},
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					409,
				);
			}

			const [inserted] = await database
				.insert(features)
				.values({
					namespace,
					key: data.key,
					name: data.name,
					description: data.description,
					meterId: data.meterId,
				})
				.returning();

			if (!inserted) throw new Error("Failed to insert feature");

			await cacheService.invalidatePattern(`features:${namespace}`);

			const result: Feature = {
				id: inserted.id,
				namespace: inserted.namespace,
				key: inserted.key,
				name: inserted.name,
				description: inserted.description ?? undefined,
				meterId: inserted.meterId ?? undefined,
				createdAt: inserted.createdAt,
				updatedAt: inserted.updatedAt,
				deletedAt: inserted.deletedAt ?? undefined,
			};

			logger.info("Created feature", {
				id: inserted.id,
				key: data.key,
				namespace,
			});
			return c.json(result, 201);
		} catch (error) {
			logger.error("Failed to create feature", error as Error, {
				key: data.key,
			});
			throw error;
		}
	},
);

// Update feature
app.put(
	"/:id",
	requireAdmin(),
	validate(
		"param",
		z.object({ id: commonSchemas.uuid.or(commonSchemas.ulid) }),
	),
	validate("json", UpdateFeatureSchema),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const id = c.req.param("id");
		const data = c.req.valid("json") as UpdateFeatureRequest;

		try {
			const database = c.get("dbService").database;

			const existing = await database
				.select()
				.from(features)
				.where(and(eq(features.id, id), eq(features.namespace, namespace)))
				.limit(1);

			if (existing.length === 0) {
				return c.json(
					{
						error: { code: "FEATURE_NOT_FOUND", message: "Feature not found" },
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					404,
				);
			}

			const [updated] = await database
				.update(features)
				.set({
					name: data.name,
					description: data.description,
					meterId: data.meterId,
					updatedAt: new Date(),
				})
				.where(and(eq(features.id, id), eq(features.namespace, namespace)))
				.returning();

			if (!updated) throw new Error("Failed to update feature");

			await cacheService.invalidatePattern(`features:${namespace}`);
			await cacheService.delete(
				CacheService.createKey("feature", namespace, id),
			);

			const result: Feature = {
				id: updated.id,
				namespace: updated.namespace,
				key: updated.key,
				name: updated.name,
				description: updated.description ?? undefined,
				meterId: updated.meterId ?? undefined,
				createdAt: updated.createdAt,
				updatedAt: updated.updatedAt,
				deletedAt: updated.deletedAt ?? undefined,
			};

			logger.info("Updated feature", { id, namespace });
			return c.json(result);
		} catch (error) {
			logger.error("Failed to update feature", error as Error, { id });
			throw error;
		}
	},
);

// Delete feature (soft delete)
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

			const [deletedRow] = await database
				.update(features)
				.set({ deletedAt: new Date(), updatedAt: new Date() })
				.where(and(eq(features.id, id), eq(features.namespace, namespace)))
				.returning();

			if (!deletedRow) {
				return c.json(
					{
						error: { code: "FEATURE_NOT_FOUND", message: "Feature not found" },
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					404,
				);
			}

			await cacheService.invalidatePattern(`features:${namespace}`);
			await cacheService.delete(
				CacheService.createKey("feature", namespace, id),
			);

			logger.info("Deleted feature", { id, namespace });
			return c.json({
				message: "Feature deleted successfully",
				id,
				deletedAt: deletedRow.deletedAt,
			});
		} catch (error) {
			logger.error("Failed to delete feature", error as Error, { id });
			throw error;
		}
	},
);

export default app;
