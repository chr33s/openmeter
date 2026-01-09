import { z } from "zod";

// Environment bindings interface
export interface Env {
	D1_DB: D1Database;
	KV_CACHE: KVNamespace;
	KV_API_KEYS: KVNamespace;
	RATE_LIMITER?: {
		limit: (options: { key: string }) => Promise<{ success: boolean }>;
	};

	// Environment variables
	ENVIRONMENT: string;
	CORS_ORIGINS: string;
	API_KEY_PREFIX: string;
	JWT_ISSUER: string;
	JWT_AUDIENCE: string;
	RATE_LIMIT_REQUESTS_PER_MINUTE: string;
	RATE_LIMIT_BURST: string;
	CACHE_TTL_SECONDS: string;
	IDEMPOTENCY_TTL_HOURS: string;

	// Secrets
	API_KEY_SECRET: string;
	JWT_SECRET: string;
}

// Cloudflare Rate Limiting binding type
// Note: RATE_LIMITER binding type is defined inline above

// Base model interfaces
export interface ManagedResource {
	id: string;
	namespace: string;
	name: string;
	description?: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt?: Date;
}

export interface ManagedModel {
	createdAt: Date;
	updatedAt: Date;
	deletedAt?: Date;
}

// Meter types
export enum MeterAggregation {
	SUM = "SUM",
	COUNT = "COUNT",
	AVG = "AVG",
	MIN = "MIN",
	MAX = "MAX",
	UNIQUE_COUNT = "UNIQUE_COUNT",
	LATEST = "LATEST",
}

export enum WindowSize {
	SECOND = "SECOND",
	MINUTE = "MINUTE",
	HOUR = "HOUR",
	DAY = "DAY",
	MONTH = "MONTH",
}

export interface Meter extends ManagedResource {
	key: string;
	aggregation: MeterAggregation;
	eventType: string;
	eventFrom?: Date;
	valueProperty?: string;
	groupBy: Record<string, string>;
}

// Subject types
export interface Subject extends ManagedModel {
	namespace: string;
	id: string;
	key: string;
	displayName?: string;
	metadata?: Record<string, any>;
	stripeCustomerId?: string;
}

export interface SubjectKey {
	key: string;
}

// Event types
export interface Event {
	id: string;
	meterId: string;
	subjectId: string;
	customerId?: string;
	timestamp: Date;
	value: number;
	properties?: Record<string, any>;
	ingestedAt: Date;
	storedAt: Date;
}

// Reserved event types that are not allowed for user events
export const RESERVED_EVENT_TYPES = [
	"openmeter.billing",
	"openmeter.subscription",
	"openmeter.entitlement",
	"openmeter.notification",
	"openmeter.system",
] as const;

// Feature types
export interface Feature extends ManagedResource {
	key: string;
	meterId?: string;
}

// Usage aggregate types
export interface UsageAggregate {
	id: string;
	meterId: string;
	subjectId: string;
	periodStart: Date;
	periodEnd: Date;
	aggType: MeterAggregation;
	value: number;
}

// API Request/Response types
export interface PaginationParams {
	limit: number;
	offset: number;
	page?: number;
	after?: string;
}

export interface PaginationResponse<T> {
	data: T[];
	totalCount: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
	page?: number;
	limit: number;
	offset: number;
}

// Meter API types
export const CreateMeterSchema = z.object({
	key: z
		.string()
		.min(1)
		.max(64)
		.regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
	name: z.string().min(1),
	description: z.string().optional(),
	aggregation: z.enum(MeterAggregation),
	eventType: z.string().min(1),
	valueProperty: z.string().optional(),
	groupBy: z.record(z.string(), z.string()).optional().default({}),
});

export const UpdateMeterSchema = CreateMeterSchema.partial().omit({
	key: true,
});

export type CreateMeterRequest = z.infer<typeof CreateMeterSchema>;
export type UpdateMeterRequest = z.infer<typeof UpdateMeterSchema>;

// Subject API types
export const CreateSubjectSchema = z.object({
	key: z.string().min(1),
	displayName: z.string().optional(),
	metadata: z.record(z.string(), z.any()).optional(),
	stripeCustomerId: z.string().optional(),
});

export const UpdateSubjectSchema = CreateSubjectSchema.partial().omit({
	key: true,
});

export type CreateSubjectRequest = z.infer<typeof CreateSubjectSchema>;
export type UpdateSubjectRequest = z.infer<typeof UpdateSubjectSchema>;

// Event API types
export const IngestEventSchema = z.object({
	subject: z.string().min(1),
	type: z
		.string()
		.min(1)
		.refine(
			(type) =>
				!RESERVED_EVENT_TYPES.some((reserved) => type.startsWith(reserved)),
			{ message: "Event type uses a reserved prefix" },
		),
	customerId: z.string().optional(),
	timestamp: z.string().check(z.iso.datetime()).optional(),
	value: z.number().optional(),
	properties: z.record(z.string(), z.any()).optional(),
});

export const BatchIngestEventSchema = z.object({
	events: z.array(IngestEventSchema).min(1).max(1000),
});

export type IngestEventRequest = z.infer<typeof IngestEventSchema>;
export type BatchIngestEventRequest = z.infer<typeof BatchIngestEventSchema>;

// Authentication types
export interface AuthContext {
	isAuthenticated: boolean;
	authenticated?: boolean; // Legacy field for backward compatibility
	role: "admin" | "read";
	namespace: string;
	source: "api-key" | "jwt";
	apiKeyValid?: boolean;
	jwtValid?: boolean;
	userId?: string;
}

// API Key storage types
export interface ApiKeyData {
	role: "admin" | "read";
	createdAt: string;
	lastUsedAt?: string;
	description?: string;
	namespace?: string;
	expiresAt?: string;
}

// Rate limiting types
export interface RateLimitResult {
	allowed: boolean;
	remaining: number;
	resetTime: number;
	retryAfter?: number;
}

// Logging types
export interface LogContext {
	requestId?: string;
	userId?: string;
	namespace?: string;
	[key: string]: any;
}

// Cache types
export interface CacheEntry<T = any> {
	value: T;
	data?: T; // Legacy property
	timestamp?: number;
	ttl?: number;
	expiresAt?: number;
	tags?: string[];
}

// Feature API types
export const CreateFeatureSchema = z.object({
	key: z
		.string()
		.min(1)
		.max(64)
		.regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
	name: z.string().min(1),
	description: z.string().optional(),
	meterId: z.string().optional(),
});

export const UpdateFeatureSchema = CreateFeatureSchema.partial().omit({
	key: true,
});

export type CreateFeatureRequest = z.infer<typeof CreateFeatureSchema>;
export type UpdateFeatureRequest = z.infer<typeof UpdateFeatureSchema>;

// Usage query types
export const UsageQuerySchema = z.object({
	meterId: z.string().optional(),
	subjectId: z.string().optional(),
	from: z.string().check(z.iso.datetime()),
	to: z.string().check(z.iso.datetime()),
	windowSize: z.enum(WindowSize).optional(),
	groupBy: z.array(z.string()).optional(),
});

export type UsageQueryRequest = z.infer<typeof UsageQuerySchema>;

export interface UsageQueryResponse {
	meterId: string;
	subjectId?: string;
	from: string;
	to: string;
	windowSize?: WindowSize;
	data: UsageDataPoint[];
}

export interface UsageDataPoint {
	timestamp: string;
	value: number;
	groupBy?: Record<string, string>;
}
