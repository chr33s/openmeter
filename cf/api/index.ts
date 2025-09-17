import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { prettyJSON } from "hono/pretty-json";
import { createMiddleware } from "hono/factory";

import type { Env } from "#/types";
import { withRequestLogging } from "#/utils/logger";
import { metrics } from "#/utils/metrics";
import { createDatabaseService } from "#/services/database";
import { createCacheService } from "#/services/cache";
import { createEventsService } from "#/services/events";

import { auth } from "#/middleware/auth";
import { rateLimit } from "#/middleware/rateLimit";
import {
	validateRequestId,
	validateContentType,
	validateIdempotencyKey,
} from "#/middleware/validation";

// Import route handlers
import metersRouter from "#/routes/meters";
import eventsRouter from "#/routes/events";
import subjectsRouter from "#/routes/subjects";
import featuresRouter from "#/routes/features";
import usageRouter from "#/routes/usage";

// Create Hono app with proper typing
const app = new Hono<{
	Bindings: Env;
	Variables: {
		dbService: any;
		cacheService: any;
		eventsService: any;
		requestId: string;
		namespace: string;
		jwtPayload?: any;
	};
}>();

// Global middleware
app.use("*", validateRequestId());

// Preflight handler returning 200 (placed before CORS middleware)
app.options("/api/*", (c) => {
	// Mirror CORS config headers
	const corsOrigins = c.env.CORS_ORIGINS?.split(",") || ["*"];
	const origin = corsOrigins.includes("*") ? "*" : (corsOrigins[0] ?? "*");

	c.header("Access-Control-Allow-Origin", origin);
	c.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,PATCH,OPTIONS");
	c.header(
		"Access-Control-Allow-Headers",
		"Content-Type, Authorization, x-api-key, x-request-id, x-namespace, idempotency-key",
	);
	c.header(
		"Access-Control-Expose-Headers",
		"x-request-id, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, retry-after, link, x-total-count, x-page, x-per-page",
	);
	c.header("Access-Control-Max-Age", "86400");
	return c.text("", 200);
});

// CORS configuration
app.use("*", async (c, next) => {
	const corsOrigins = c.env.CORS_ORIGINS?.split(",") || ["*"];

	const corsMiddleware = cors({
		origin: corsOrigins,
		allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"x-api-key",
			"x-request-id",
			"x-namespace",
			"idempotency-key",
		],
		exposeHeaders: [
			"x-request-id",
			"x-ratelimit-limit",
			"x-ratelimit-remaining",
			"x-ratelimit-reset",
			"retry-after",
			"link",
			"x-total-count",
			"x-page",
			"x-per-page",
		],
		maxAge: 86400,
	});

	return corsMiddleware(c, next);
});

// Request logging
app.use("*", logger());

// Pretty JSON in development
app.use("*", async (c, next) => {
	if (c.env.ENVIRONMENT === "development") {
		return prettyJSON()(c, next);
	}
	await next();
});

// Global rate limiting
app.use("/api/*", rateLimit());

// Services injection middleware
app.use(
	"/api/*",
	createMiddleware(async (c, next) => {
		// Initialize services
		const dbService = createDatabaseService(c.env);
		const cacheService = createCacheService(c.env);
		const eventsService = createEventsService(dbService);

		// Inject services into context
		c.set("dbService", dbService);
		c.set("cacheService", cacheService);
		c.set("eventsService", eventsService);

		await next();
	}),
);

// Authentication
app.use("/api/*", auth());

// Populate namespace on context for downstream handlers
app.use(
	"/api/*",
	createMiddleware(async (c, next) => {
		try {
			const authCtx = c.get("auth") as { namespace?: string } | undefined;
			const ns = authCtx?.namespace || "default";
			c.set("namespace", ns);
		} catch {
			// Fallback to default if anything goes wrong
			c.set("namespace", "default");
		}
		await next();
	}),
);

// Ensure CORS preflight returns 200 (test expects 200, not 204)
app.options("/api/*", (c) => {
	return c.text("", 200);
});

// Content type validation for write operations
app.use("/api/*/events", validateContentType());
app.use("/api/*/meters", validateContentType());
app.use("/api/*/subjects", validateContentType());
app.use("/api/*/features", validateContentType());

// Idempotency key validation
app.use("/api/*/events", validateIdempotencyKey());

// Request timing middleware
app.use(
	"*",
	createMiddleware(async (c, next) => {
		const start = Date.now();

		await next();

		const duration = Date.now() - start;
		const method = c.req.method;
		const path = new URL(c.req.url).pathname;
		const status = c.res.status;

		// Record metrics
		metrics.recordHttpRequest(method, path, status, duration);

		// Add timing header
		c.header("x-response-time", `${duration}ms`);
	}),
);

// Health check endpoint
app.get("/health", async (c) => {
	const logger = withRequestLogging(c.req);

	try {
		const dbService = createDatabaseService(c.env);
		const cacheService = createCacheService(c.env);

		// Run health checks in parallel
		const [dbHealth, cacheHealth] = await Promise.allSettled([
			dbService.healthCheck(),
			cacheService.healthCheck(),
		]);

		const health = {
			status: "ok" as "ok" | "degraded" | "down",
			timestamp: new Date().toISOString(),
			checks: {
				database:
					dbHealth.status === "fulfilled" && dbHealth.value ? "ok" : "error",
				cache:
					cacheHealth.status === "fulfilled" && cacheHealth.value
						? "ok"
						: "error",
			},
			version: "1.0.0",
		};

		// Determine overall status
		const hasErrors = Object.values(health.checks).some(
			(status) => status === "error",
		);
		if (hasErrors) {
			health.status = "degraded";
		}

		const statusCode = health.status === "ok" ? 200 : 503;

		logger.info("Health check completed", {
			status: health.status,
			checks: health.checks,
		});

		return c.json(health, statusCode);
	} catch (error) {
		logger.error("Health check failed", error as Error);

		return c.json(
			{
				status: "down",
				timestamp: new Date().toISOString(),
				checks: {
					database: "error",
					cache: "error",
				},
				version: "1.0.0",
			},
			503,
		);
	}
});

// Metrics endpoint
app.get("/metrics", async (c) => {
	const format = c.req.query("format") || "json";

	if (format === "prometheus") {
		c.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
		return c.text(metrics.getPrometheusMetrics());
	}

	return c.json(metrics.getMetricsSummary());
});

// API documentation endpoint
app.get("/docs", async (c) => {
	// In a full implementation, this would serve the OpenAPI spec
	// For now, return a simple documentation response
	return c.json({
		name: "OpenMeter Cloudflare Workers API",
		version: "1.0.0",
		description:
			"A TypeScript implementation of OpenMeter using Cloudflare Workers",
		endpoints: {
			health: "GET /health",
			metrics: "GET /metrics",
			docs: "GET /docs",
			api: {
				meters: "GET,POST,PUT,DELETE /api/v1/meters",
				events: "GET,POST /api/v1/events",
				subjects: "GET,POST,PUT,DELETE /api/v1/subjects",
				features: "GET,POST,PUT,DELETE /api/v1/features",
				usage: "GET /api/v1/usage",
			},
		},
		authentication: {
			apiKey: "Include x-api-key header",
			jwt: "Include Authorization: Bearer <token> header",
		},
		repository: "https://github.com/openmeterio/openmeter",
	});
});

// Mount API routes
app.route("/api/v1/meters", metersRouter);
app.route("/api/v1/events", eventsRouter);
app.route("/api/v1/subjects", subjectsRouter);
app.route("/api/v1/features", featuresRouter);
app.route("/api/v1/usage", usageRouter);

// 404 handler
app.notFound((c) => {
	return c.json(
		{
			error: {
				code: "NOT_FOUND",
				message: "The requested resource was not found",
			},
			timestamp: new Date().toISOString(),
			requestId: c.get("requestId"),
		},
		404,
	);
});

// Global error handler
app.onError((error, c) => {
	const logger = withRequestLogging(c.req);
	logger.error("Unhandled error", error);

	// Don't expose internal errors in production
	const isDevelopment = c.env?.ENVIRONMENT === "development";

	return c.json(
		{
			error: {
				code: "INTERNAL_ERROR",
				message: isDevelopment ? error.message : "Internal server error",
			},
			timestamp: new Date().toISOString(),
			requestId: c.get("requestId"),
		},
		500,
	);
});

export default app;
