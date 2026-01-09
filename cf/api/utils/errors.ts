import type { Context } from "hono";

// Standard error codes used throughout the API
export const ErrorCodes = {
	// Authentication & Authorization
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",

	// Validation
	VALIDATION_ERROR: "VALIDATION_ERROR",
	INVALID_REQUEST: "INVALID_REQUEST",

	// Resource errors
	NOT_FOUND: "NOT_FOUND",
	METER_NOT_FOUND: "METER_NOT_FOUND",
	EVENT_NOT_FOUND: "EVENT_NOT_FOUND",
	FEATURE_NOT_FOUND: "FEATURE_NOT_FOUND",
	SUBJECT_NOT_FOUND: "SUBJECT_NOT_FOUND",

	// Conflict errors
	ALREADY_EXISTS: "ALREADY_EXISTS",
	METER_ALREADY_EXISTS: "METER_ALREADY_EXISTS",
	FEATURE_ALREADY_EXISTS: "FEATURE_ALREADY_EXISTS",
	SUBJECT_ALREADY_EXISTS: "SUBJECT_ALREADY_EXISTS",

	// Rate limiting
	RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

	// Batch errors
	BATCH_TOO_LARGE: "BATCH_TOO_LARGE",

	// Internal errors
	INTERNAL_ERROR: "INTERNAL_ERROR",
	DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// HTTP status code mapping for error codes
const errorStatusMap: Record<ErrorCode, number> = {
	[ErrorCodes.UNAUTHORIZED]: 401,
	[ErrorCodes.FORBIDDEN]: 403,
	[ErrorCodes.VALIDATION_ERROR]: 400,
	[ErrorCodes.INVALID_REQUEST]: 400,
	[ErrorCodes.NOT_FOUND]: 404,
	[ErrorCodes.METER_NOT_FOUND]: 404,
	[ErrorCodes.EVENT_NOT_FOUND]: 404,
	[ErrorCodes.FEATURE_NOT_FOUND]: 404,
	[ErrorCodes.SUBJECT_NOT_FOUND]: 404,
	[ErrorCodes.ALREADY_EXISTS]: 409,
	[ErrorCodes.METER_ALREADY_EXISTS]: 409,
	[ErrorCodes.FEATURE_ALREADY_EXISTS]: 409,
	[ErrorCodes.SUBJECT_ALREADY_EXISTS]: 409,
	[ErrorCodes.RATE_LIMIT_EXCEEDED]: 429,
	[ErrorCodes.BATCH_TOO_LARGE]: 400,
	[ErrorCodes.INTERNAL_ERROR]: 500,
	[ErrorCodes.DATABASE_ERROR]: 500,
};

export interface ApiError {
	code: ErrorCode;
	message: string;
	details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
	error: ApiError;
	timestamp: string;
	requestId: string;
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
	c: Context,
	code: ErrorCode,
	message: string,
	details?: Record<string, unknown>,
): Response {
	const requestId = c.get("requestId") || "unknown";
	const status = errorStatusMap[code] || 500;

	const response: ApiErrorResponse = {
		error: {
			code,
			message,
			...(details && { details }),
		},
		timestamp: new Date().toISOString(),
		requestId,
	};

	return c.json(response, status as any);
}

/**
 * Helper to create not found error
 */
export function notFoundError(
	c: Context,
	resource: "meter" | "event" | "feature" | "subject",
	message?: string,
): Response {
	const codeMap = {
		meter: ErrorCodes.METER_NOT_FOUND,
		event: ErrorCodes.EVENT_NOT_FOUND,
		feature: ErrorCodes.FEATURE_NOT_FOUND,
		subject: ErrorCodes.SUBJECT_NOT_FOUND,
	};

	return createErrorResponse(
		c,
		codeMap[resource],
		message ||
			`${resource.charAt(0).toUpperCase() + resource.slice(1)} not found`,
	);
}

/**
 * Helper to create already exists error
 */
export function alreadyExistsError(
	c: Context,
	resource: "meter" | "feature" | "subject",
	message?: string,
): Response {
	const codeMap = {
		meter: ErrorCodes.METER_ALREADY_EXISTS,
		feature: ErrorCodes.FEATURE_ALREADY_EXISTS,
		subject: ErrorCodes.SUBJECT_ALREADY_EXISTS,
	};

	return createErrorResponse(
		c,
		codeMap[resource],
		message || `A ${resource} with this key already exists`,
	);
}

/**
 * Helper to create unauthorized error
 */
export function unauthorizedError(c: Context, message?: string): Response {
	return createErrorResponse(
		c,
		ErrorCodes.UNAUTHORIZED,
		message || "Authentication required",
	);
}

/**
 * Helper to create validation error
 */
export function validationError(
	c: Context,
	message: string,
	details?: Record<string, unknown>,
): Response {
	return createErrorResponse(c, ErrorCodes.VALIDATION_ERROR, message, details);
}
