import { Hono } from "hono";
import { z } from "zod";
import type {
	Env,
	Subject,
	CreateSubjectRequest,
	UpdateSubjectRequest,
	PaginationResponse,
} from "#/types";
import { CreateSubjectSchema, UpdateSubjectSchema } from "#/types";
import { subjects } from "#/services/database";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth, requireAdmin } from "#/middleware/auth";
import { validate, commonSchemas } from "#/middleware/validation";
import { perUserRateLimit } from "#/middleware/rateLimit";
import { withRequestLogging } from "#/utils/logger";
import { pagination, addPaginationHeaders } from "#/utils/pagination";
import { CacheService } from "#/services/cache";
import { DatabaseService } from "#/services/database";

const app = new Hono<{
	Bindings: Env;
	Variables: {
		dbService: DatabaseService;
		cacheService: CacheService;
		namespace: string;
		requestId: string;
	};
}>();

// List subjects
app.get(
	"/",
	validate(
		"query",
		commonSchemas.paginationQuery.extend({
			search: commonSchemas.filterQuery.shape.search,
			stripeCustomerId: z.string().optional(),
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
				"subjects",
				namespace,
				JSON.stringify(query),
			);

			// Try cache first
			const cached =
				await cacheService.get<PaginationResponse<Subject>>(cacheKey);
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
			const conditions = [eq(subjects.namespace, namespace)];

			if (query.search) {
				conditions.push(
					sql`(${subjects.key} LIKE ${`%${query.search}%`} OR ${subjects.displayName} LIKE ${`%${query.search}%`})`,
				);
			}

			if (query.stripeCustomerId) {
				conditions.push(eq(subjects.stripeCustomerId, query.stripeCustomerId));
			}

			const rows = await database
				.select()
				.from(subjects)
				.where(and(...conditions))
				.orderBy(desc(subjects.createdAt))
				.limit(paginationParams.limit)
				.offset(paginationParams.offset);

			const countRows = await database
				.select({ count: sql<number>`count(*)` })
				.from(subjects)
				.where(and(...conditions));

			const totalCount = Number(countRows[0]?.count ?? 0);

			const result = pagination.createResponse(
				rows.map(
					(s) =>
						({
							id: s.id,
							namespace: s.namespace,
							key: s.key,
							displayName: s.displayName ?? undefined,
							metadata: s.metadata ?? undefined,
							stripeCustomerId: s.stripeCustomerId ?? undefined,
							createdAt: s.createdAt,
							updatedAt: s.updatedAt,
							deletedAt: s.deletedAt ?? undefined,
						}) as Subject,
				),
				paginationParams,
				totalCount,
			);

			await cacheService.set(cacheKey, result, 300);

			logger.info("Listed subjects", {
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
			logger.error("Failed to list subjects", error as Error);
			throw error;
		}
	},
);

// Get subject by ID
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
			const cacheKey = CacheService.createKey("subject", namespace, id);
			const cached = await cacheService.get<Subject>(cacheKey);
			if (cached) {
				logger.cacheOperation("hit", cacheKey);
				return c.json(cached);
			}

			logger.cacheOperation("miss", cacheKey);

			const database = dbService.database;
			const rows = await database
				.select()
				.from(subjects)
				.where(and(eq(subjects.id, id), eq(subjects.namespace, namespace)))
				.limit(1);

			if (rows.length === 0) {
				return c.json(
					{
						error: { code: "SUBJECT_NOT_FOUND", message: "Subject not found" },
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					404,
				);
			}

			const s = rows[0]!;
			const result: Subject = {
				id: s.id,
				namespace: s.namespace,
				key: s.key,
				displayName: s.displayName ?? undefined,
				metadata: s.metadata ?? undefined,
				stripeCustomerId: s.stripeCustomerId ?? undefined,
				createdAt: s.createdAt,
				updatedAt: s.updatedAt,
				deletedAt: s.deletedAt ?? undefined,
			};

			await cacheService.set(cacheKey, result, 300);
			logger.info("Retrieved subject", { id, namespace });
			return c.json(result);
		} catch (error) {
			logger.error("Failed to get subject", error as Error, { id });
			throw error;
		}
	},
);

// Create subject
app.post(
	"/",
	requireAuth(),
	perUserRateLimit({ requestsPerMinute: 30 }),
	validate("json", CreateSubjectSchema),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const dbService = c.get("dbService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const data = c.req.valid("json") as CreateSubjectRequest;

		try {
			const database = dbService.database;

			// Check for existing key
			const existing = await database
				.select()
				.from(subjects)
				.where(
					and(eq(subjects.namespace, namespace), eq(subjects.key, data.key)),
				)
				.limit(1);

			if (existing.length > 0) {
				return c.json(
					{
						error: {
							code: "SUBJECT_ALREADY_EXISTS",
							message: "A subject with this key already exists",
						},
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					409,
				);
			}

			const [inserted] = await database
				.insert(subjects)
				.values({
					namespace,
					key: data.key,
					displayName: data.displayName ?? data.key,
					metadata: data.metadata,
					stripeCustomerId: data.stripeCustomerId,
				})
				.returning();

			if (!inserted) throw new Error("Failed to insert subject");

			await cacheService.invalidatePattern(`subjects:${namespace}`);

			const result: Subject = {
				id: inserted.id,
				namespace: inserted.namespace,
				key: inserted.key,
				displayName: inserted.displayName ?? undefined,
				metadata: inserted.metadata ?? undefined,
				stripeCustomerId: inserted.stripeCustomerId ?? undefined,
				createdAt: inserted.createdAt,
				updatedAt: inserted.updatedAt,
				deletedAt: inserted.deletedAt ?? undefined,
			};

			logger.info("Created subject", {
				id: inserted.id,
				key: data.key,
				namespace,
			});
			return c.json(result, 201);
		} catch (error) {
			logger.error("Failed to create subject", error as Error, {
				key: data.key,
			});
			throw error;
		}
	},
);

// Update subject
app.put(
	"/:id",
	requireAdmin(),
	validate(
		"param",
		z.object({ id: commonSchemas.uuid.or(commonSchemas.ulid) }),
	),
	validate("json", UpdateSubjectSchema),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const dbService = c.get("dbService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const id = c.req.param("id");
		const data = c.req.valid("json") as UpdateSubjectRequest;

		try {
			const database = dbService.database;

			const existing = await database
				.select()
				.from(subjects)
				.where(and(eq(subjects.id, id), eq(subjects.namespace, namespace)))
				.limit(1);

			if (existing.length === 0) {
				return c.json(
					{
						error: { code: "SUBJECT_NOT_FOUND", message: "Subject not found" },
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					404,
				);
			}

			const [updated] = await database
				.update(subjects)
				.set({
					displayName: data.displayName,
					metadata: data.metadata,
					stripeCustomerId: data.stripeCustomerId,
					updatedAt: new Date(),
				})
				.where(and(eq(subjects.id, id), eq(subjects.namespace, namespace)))
				.returning();

			if (!updated) throw new Error("Failed to update subject");

			await cacheService.invalidatePattern(`subjects:${namespace}`);
			await cacheService.delete(
				CacheService.createKey("subject", namespace, id),
			);

			const result: Subject = {
				id: updated.id,
				namespace: updated.namespace,
				key: updated.key,
				displayName: updated.displayName ?? undefined,
				metadata: updated.metadata ?? undefined,
				stripeCustomerId: updated.stripeCustomerId ?? undefined,
				createdAt: updated.createdAt,
				updatedAt: updated.updatedAt,
				deletedAt: updated.deletedAt ?? undefined,
			};

			logger.info("Updated subject", { id, namespace });
			return c.json(result);
		} catch (error) {
			logger.error("Failed to update subject", error as Error, { id });
			throw error;
		}
	},
);

// Delete subject (soft delete)
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
				.update(subjects)
				.set({ deletedAt: new Date(), updatedAt: new Date() })
				.where(and(eq(subjects.id, id), eq(subjects.namespace, namespace)))
				.returning();

			if (!deletedRow) {
				return c.json(
					{
						error: { code: "SUBJECT_NOT_FOUND", message: "Subject not found" },
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					404,
				);
			}

			await cacheService.invalidatePattern(`subjects:${namespace}`);
			await cacheService.delete(
				CacheService.createKey("subject", namespace, id),
			);

			logger.info("Deleted subject", { id, namespace });
			return c.json({
				message: "Subject deleted successfully",
				id,
				deletedAt: deletedRow.deletedAt,
			});
		} catch (error) {
			logger.error("Failed to delete subject", error as Error, { id });
			throw error;
		}
	},
);

export default app;
