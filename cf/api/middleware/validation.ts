import { createMiddleware } from "hono/factory";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Env } from "#/types";

// Generic validation middleware with better error formatting
export const validate = <T extends z.ZodSchema>(
	target: "json" | "query" | "param" | "header",
	schema: T,
) => {
	return zValidator(target, schema, (result, c) => {
		if (!result.success) {
			return c.json(
				{
					error: {
						code: "VALIDATION_ERROR",
						message: "Request validation failed",
						// Cast to unknown to satisfy invariant generic on ZodError
						details: formatZodError(
							result.error as unknown as z.ZodError<unknown>,
						),
					},
					timestamp: new Date().toISOString(),
					// The validator callback context may not carry Variables typing; use a safe cast
					requestId: (c.get as unknown as (key: string) => unknown)(
						"requestId",
					) as string | undefined,
				},
				400,
			);
		}
	});
};

// Format Zod validation errors
function formatZodError(error: z.ZodError<unknown>): Array<{
	field: string;
	message: string;
	code: string;
}> {
	return error.issues.map((err) => ({
		field: err.path.join("."),
		message: err.message,
		code: err.code,
	}));
}

// Common validation schemas
export const commonSchemas = {
	// UUID validation
	uuid: z.string().uuid("Invalid UUID format"),

	// ULID validation (OpenMeter uses ULIDs)
	ulid: z
		.string()
		.regex(/^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/, "Invalid ULID format"),

	// Key validation (alphanumeric with underscores)
	key: z
		.string()
		.min(1)
		.max(64)
		.regex(
			/^[a-z0-9]+(?:_[a-z0-9]+)*$/,
			"Key must contain only lowercase letters, numbers, and underscores",
		),

	// Namespace validation
	namespace: z
		.string()
		.min(1)
		.max(64)
		.regex(
			/^[a-z0-9]+(?:[-_][a-z0-9]+)*$/,
			"Namespace must contain only lowercase letters, numbers, hyphens, and underscores",
		),

	// Pagination params
	paginationQuery: z.object({
		limit: z
			.string()
			.optional()
			.transform((val) => {
				if (!val) return 20;
				const num = parseInt(val, 10);
				return isNaN(num) ? 20 : Math.min(Math.max(num, 1), 100);
			}),
		offset: z
			.string()
			.optional()
			.transform((val) => {
				if (!val) return 0;
				const num = parseInt(val, 10);
				return isNaN(num) ? 0 : Math.max(num, 0);
			}),
		page: z
			.string()
			.optional()
			.transform((val) => {
				if (!val) return undefined;
				const num = parseInt(val, 10);
				return isNaN(num) || num < 1 ? undefined : num;
			}),
		after: z.string().optional(),
	}),

	// Date range query
	dateRangeQuery: z
		.object({
			from: z.string().datetime("Invalid from date format (ISO 8601 required)"),
			to: z.string().datetime("Invalid to date format (ISO 8601 required)"),
		})
		.refine(
			(data) => new Date(data.from) < new Date(data.to),
			"From date must be before to date",
		),

	// Filter query
	filterQuery: z.object({
		search: z.string().optional(),
		status: z.enum(["active", "inactive", "deleted"]).optional(),
		tags: z
			.string()
			.optional()
			.transform((val) =>
				val ? val.split(",").map((tag) => tag.trim()) : undefined,
			),
	}),
};

// Validation for request IDs
export const validateRequestId = () =>
	createMiddleware<{ Bindings: Env; Variables: { requestId: string } }>(
		async (c, next) => {
			// Generate or extract request ID
			const requestId = c.req.header("x-request-id") || crypto.randomUUID();
			c.set("requestId", requestId);

			// Add to response headers
			c.header("x-request-id", requestId);

			await next();
		},
	);

// Validate content type for POST/PUT requests
export const validateContentType = (
	expectedType: string = "application/json",
) =>
	createMiddleware<{ Bindings: Env; Variables: { requestId: string } }>(
		async (c, next) => {
			const method = c.req.method;

			if (method === "POST" || method === "PUT" || method === "PATCH") {
				const contentType = c.req.header("content-type");

				if (!contentType || !contentType.includes(expectedType)) {
					return c.json(
						{
							error: {
								code: "INVALID_CONTENT_TYPE",
								message: `Content-Type must be ${expectedType}`,
								details: {
									expected: expectedType,
									received: contentType || "none",
								},
							},
							timestamp: new Date().toISOString(),
							requestId: c.get("requestId"),
						},
						400,
					);
				}
			}

			await next();
		},
	);

// Validate idempotency key for POST requests
export const validateIdempotencyKey = () =>
	createMiddleware<{
		Bindings: Env;
		Variables: { idempotencyKey?: string; requestId: string };
	}>(async (c, next) => {
		const method = c.req.method;

		if (method === "POST") {
			const idempotencyKey = c.req.header("idempotency-key");

			if (idempotencyKey) {
				// Validate idempotency key format
				if (idempotencyKey.length < 1 || idempotencyKey.length > 255) {
					return c.json(
						{
							error: {
								code: "INVALID_IDEMPOTENCY_KEY",
								message: "Idempotency key must be between 1 and 255 characters",
							},
							timestamp: new Date().toISOString(),
							requestId: c.get("requestId"),
						},
						400,
					);
				}

				c.set("idempotencyKey", idempotencyKey);
			}
		}

		await next();
	});

// Body size validation
export const validateBodySize = (
	maxSize: number = 1024 * 1024, // 1MB default
) =>
	createMiddleware<{ Bindings: Env; Variables: { requestId: string } }>(
		async (c, next) => {
			const contentLength = c.req.header("content-length");

			if (contentLength) {
				const size = parseInt(contentLength, 10);

				if (size > maxSize) {
					return c.json(
						{
							error: {
								code: "PAYLOAD_TOO_LARGE",
								message: "Request body too large",
								details: {
									maxSize,
									receivedSize: size,
								},
							},
							timestamp: new Date().toISOString(),
							requestId: c.get("requestId"),
						},
						413,
					);
				}
			}

			await next();
		},
	);
