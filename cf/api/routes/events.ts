// Events API routes

import { Hono } from "hono";
import { z } from "zod";
import type {
	Env,
	IngestEventRequest,
	BatchIngestEventRequest,
	Event,
	PaginationResponse,
} from "#/types";
import { IngestEventSchema, BatchIngestEventSchema } from "#/types";
import { requireAuth } from "#/middleware/auth";
import {
	validate,
	commonSchemas,
	validateIdempotencyKey,
} from "#/middleware/validation";
import { strictRateLimit, perUserRateLimit } from "#/middleware/rateLimit";
import { withRequestLogging } from "#/utils/logger";
import { pagination, addPaginationHeaders } from "#/utils/pagination";
import { metrics } from "#/utils/metrics";
import { CacheService } from "#/services/cache";
import { DatabaseService } from "#/services/database";
import { EventsService } from "#/services/events";

const app = new Hono<{
	Bindings: Env;
	Variables: {
		dbService: DatabaseService;
		cacheService: CacheService;
		eventsService: EventsService;
		namespace: string;
		requestId: string;
		idempotencyKey?: string;
	};
}>();

// Query events
app.get(
	"/",
	requireAuth(),
	validate(
		"query",
		commonSchemas.paginationQuery.extend({
			meterId: z.string().optional(),
			subjectId: z.string().optional(),
			from: z.string().datetime().optional(),
			to: z.string().datetime().optional(),
		}),
	),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const eventsService = c.get("eventsService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const query = c.req.valid("query");

		try {
			const paginationParams = pagination.parseParams(
				new URL(c.req.url).searchParams,
			);
			const cacheKey = CacheService.createKey(
				"events",
				namespace,
				JSON.stringify(query),
			);

			// Try cache first (shorter TTL for events)
			const cached =
				await cacheService.get<PaginationResponse<Event>>(cacheKey);
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

			// Query events
			const result = await eventsService.queryEvents({
				namespace,
				meterId: query.meterId,
				subjectId: query.subjectId,
				from: query.from ? new Date(query.from) : undefined,
				to: query.to ? new Date(query.to) : undefined,
				limit: paginationParams.limit,
				offset: paginationParams.offset,
			});

			const response = pagination.createResponse(
				result.events,
				paginationParams,
				result.totalCount,
			);

			// Cache result for shorter time (events change frequently)
			await cacheService.set(cacheKey, response, 60); // 1 minute

			logger.info("Queried events", {
				count: result.events.length,
				totalCount: result.totalCount,
				namespace,
			});

			const httpResponse = Response.json(response);
			return addPaginationHeaders(
				httpResponse,
				c.req.url,
				paginationParams,
				result.totalCount,
			);
		} catch (error) {
			logger.error("Failed to query events", error as Error);
			throw error;
		}
	},
);

// Ingest single event
app.post(
	"/",
	requireAuth(),
	perUserRateLimit({ requestsPerMinute: 1000, burstLimit: 100 }),
	validateIdempotencyKey(),
	validate("json", IngestEventSchema),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const eventsService = c.get("eventsService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const idempotencyKey = c.get("idempotencyKey");
		const data = c.req.valid("json") as IngestEventRequest;

		const start = Date.now();

		try {
			// Check idempotency
			if (idempotencyKey) {
				const idempotencyResult = await checkIdempotency(
					cacheService,
					idempotencyKey,
					namespace,
					"single-event",
				);

				if (idempotencyResult) {
					logger.info("Idempotent request detected", { idempotencyKey });
					return c.json(idempotencyResult);
				}
			}

			// Ingest event
			const result = await eventsService.ingestEvent(namespace, data);

			// Store idempotency result
			if (idempotencyKey) {
				await storeIdempotencyResult(
					cacheService,
					idempotencyKey,
					namespace,
					"single-event",
					result,
				);
			}

			// Invalidate event caches
			await cacheService.invalidatePattern(`events:${namespace}`);

			const duration = Date.now() - start;

			// Record metrics
			metrics.recordEventIngestion("single", 1, duration, 1, 0);

			logger.info("Ingested event", {
				eventId: result.eventId,
				subject: data.subject,
				type: data.type,
				namespace,
				duration,
			});

			return c.json(
				{
					eventId: result.eventId,
					processed: result.processed,
					timestamp: new Date().toISOString(),
				},
				201,
			);
		} catch (error) {
			const duration = Date.now() - start;
			metrics.recordEventIngestion("single", 1, duration, 0, 1);

			logger.error("Failed to ingest event", error as Error, {
				subject: data.subject,
				type: data.type,
			});

			throw error;
		}
	},
);

// Ingest batch of events
app.post(
	"/batch",
	requireAuth(),
	strictRateLimit(),
	validateIdempotencyKey(),
	validate("json", BatchIngestEventSchema),
	async (c) => {
		const logger = withRequestLogging(c.req);
		const eventsService = c.get("eventsService");
		const cacheService = c.get("cacheService");
		const namespace = c.get("namespace");
		const idempotencyKey = c.get("idempotencyKey");
		const data = c.req.valid("json") as BatchIngestEventRequest;

		const start = Date.now();

		try {
			// Check idempotency
			if (idempotencyKey) {
				const idempotencyResult = await checkIdempotency(
					cacheService,
					idempotencyKey,
					namespace,
					"batch-events",
				);

				if (idempotencyResult) {
					logger.info("Idempotent batch request detected", {
						idempotencyKey,
						events: data.events.length,
					});
					return c.json(idempotencyResult);
				}
			}

			// Validate batch size
			if (data.events.length > 1000) {
				return c.json(
					{
						error: {
							code: "BATCH_TOO_LARGE",
							message: "Batch size cannot exceed 1000 events",
						},
						timestamp: new Date().toISOString(),
						requestId: c.get("requestId"),
					},
					400,
				);
			}

			// Ingest batch
			const result = await eventsService.ingestBatchEvents(namespace, data);

			// Store idempotency result
			if (idempotencyKey) {
				await storeIdempotencyResult(
					cacheService,
					idempotencyKey,
					namespace,
					"batch-events",
					result,
				);
			}

			// Invalidate event caches
			await cacheService.invalidatePattern(`events:${namespace}`);

			const duration = Date.now() - start;

			// Record metrics
			metrics.recordEventIngestion(
				"batch",
				result.totalEvents,
				duration,
				result.processedEvents,
				result.failedEvents,
			);

			logger.info("Ingested batch events", {
				total: result.totalEvents,
				processed: result.processedEvents,
				failed: result.failedEvents,
				namespace,
				duration,
			});

			const statusCode = result.failedEvents > 0 ? 207 : 201; // 207 Multi-Status if partial failure

			return c.json(
				{
					totalEvents: result.totalEvents,
					processedEvents: result.processedEvents,
					failedEvents: result.failedEvents,
					errors:
						result.errors.length > 0 ? result.errors.slice(0, 10) : undefined, // Limit error details
					timestamp: new Date().toISOString(),
				},
				statusCode,
			);
		} catch (error) {
			const duration = Date.now() - start;
			metrics.recordEventIngestion(
				"batch",
				data.events.length,
				duration,
				0,
				data.events.length,
			);

			logger.error("Failed to ingest batch events", error as Error, {
				eventsCount: data.events.length,
			});

			throw error;
		}
	},
);

// Helper function to check idempotency
async function checkIdempotency(
	cacheService: CacheService,
	key: string,
	namespace: string,
	operation: string,
): Promise<any | null> {
	const cacheKey = CacheService.createKey(
		"idempotency",
		namespace,
		operation,
		key,
	);
	return await cacheService.get(cacheKey);
}

// Helper function to store idempotency result
async function storeIdempotencyResult(
	cacheService: CacheService,
	key: string,
	namespace: string,
	operation: string,
	result: any,
): Promise<void> {
	const cacheKey = CacheService.createKey(
		"idempotency",
		namespace,
		operation,
		key,
	);
	// Store for 24 hours (configurable via env)
	await cacheService.set(cacheKey, result, 24 * 60 * 60);
}

export default app;
