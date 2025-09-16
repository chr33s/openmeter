// Core type definitions for OpenMeter Cloudflare Workers API

import { z } from 'zod';

// Environment bindings interface
export interface Env {
  D1_DB: D1Database;
  KV_CACHE: KVNamespace;
  AI: Ai;
  
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
  DEFAULT_AI_MODEL: string;
  
  // Secrets
  API_KEY_SECRET: string;
  JWT_SECRET: string;
}

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
  SUM = 'SUM',
  COUNT = 'COUNT',
  AVG = 'AVG',
  MIN = 'MIN',
  MAX = 'MAX',
  UNIQUE_COUNT = 'UNIQUE_COUNT',
  LATEST = 'LATEST'
}

export enum WindowSize {
  SECOND = 'SECOND',
  MINUTE = 'MINUTE',
  HOUR = 'HOUR',
  DAY = 'DAY',
  MONTH = 'MONTH'
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
  timestamp: Date;
  value: number;
  properties?: Record<string, any>;
}

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
  limit?: number;
  offset?: number;
  page?: number;
  after?: string;
}

export interface PaginationResponse<T> {
  data: T[];
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  page?: number;
  limit?: number;
  offset?: number;
}

// Meter API types
export const CreateMeterSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  name: z.string().min(1),
  description: z.string().optional(),
  aggregation: z.nativeEnum(MeterAggregation),
  eventType: z.string().min(1),
  valueProperty: z.string().optional(),
  groupBy: z.record(z.string()).optional().default({})
});

export const UpdateMeterSchema = CreateMeterSchema.partial().omit({ key: true });

export type CreateMeterRequest = z.infer<typeof CreateMeterSchema>;
export type UpdateMeterRequest = z.infer<typeof UpdateMeterSchema>;

// Subject API types
export const CreateSubjectSchema = z.object({
  key: z.string().min(1),
  displayName: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  stripeCustomerId: z.string().optional()
});

export const UpdateSubjectSchema = CreateSubjectSchema.partial().omit({ key: true });

export type CreateSubjectRequest = z.infer<typeof CreateSubjectSchema>;
export type UpdateSubjectRequest = z.infer<typeof UpdateSubjectSchema>;

// Event API types
export const IngestEventSchema = z.object({
  subject: z.string().min(1),
  type: z.string().min(1),
  timestamp: z.string().datetime().optional(),
  value: z.number().optional(),
  properties: z.record(z.any()).optional()
});

export const BatchIngestEventSchema = z.object({
  events: z.array(IngestEventSchema).min(1).max(1000)
});

export type IngestEventRequest = z.infer<typeof IngestEventSchema>;
export type BatchIngestEventRequest = z.infer<typeof BatchIngestEventSchema>;

// Feature API types
export const CreateFeatureSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
  name: z.string().min(1),
  description: z.string().optional(),
  meterId: z.string().optional()
});

export const UpdateFeatureSchema = CreateFeatureSchema.partial().omit({ key: true });

export type CreateFeatureRequest = z.infer<typeof CreateFeatureSchema>;
export type UpdateFeatureRequest = z.infer<typeof UpdateFeatureSchema>;

// Usage query types
export const UsageQuerySchema = z.object({
  meterId: z.string().optional(),
  subjectId: z.string().optional(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  windowSize: z.nativeEnum(WindowSize).optional(),
  groupBy: z.array(z.string()).optional()
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

// AI API types
export const AICompleteSchema = z.object({
  model: z.string().optional(),
  prompt: z.string().min(1),
  max_tokens: z.number().min(1).max(4096).optional(),
  temperature: z.number().min(0).max(2).optional(),
  stream: z.boolean().optional()
});

export type AICompleteRequest = z.infer<typeof AICompleteSchema>;

export interface AICompleteResponse {
  model: string;
  choices: Array<{
    text: string;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Error types
export interface APIError {
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
  requestId: string;
}

// Auth types
export interface AuthContext {
  authenticated: boolean;
  apiKeyValid: boolean;
  jwtValid: boolean;
  userId?: string;
  role?: 'admin' | 'read';
}

// Cache types
export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Logger types
export interface LogContext {
  requestId: string;
  method: string;
  url: string;
  userAgent?: string;
  cf?: any;
  startTime: number;
}

// Rate limiting types
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Health check types
export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  checks: {
    database: 'ok' | 'error';
    cache: 'ok' | 'error';
    ai: 'ok' | 'error';
  };
  version: string;
}