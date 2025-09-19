import { sql } from "drizzle-orm";
import {
	sqliteTable,
	text,
	integer,
	real,
	unique,
	index,
	foreignKey,
} from "drizzle-orm/sqlite-core";
import { drizzle } from "drizzle-orm/d1";

import type { Env } from "#api/types";

// Schema definitions using Drizzle ORM
export const meters = sqliteTable(
	"meters",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		namespace: text("namespace").notNull().default("default"),
		key: text("key").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		aggregation: text("aggregation", {
			enum: ["SUM", "COUNT", "AVG", "MIN", "MAX", "UNIQUE_COUNT", "LATEST"],
		}).notNull(),
		eventType: text("event_type").notNull(),
		eventFrom: integer("event_from", { mode: "timestamp" }),
		valueProperty: text("value_property"),
		groupBy: text("group_by", { mode: "json" })
			.$type<Record<string, string>>()
			.default({}),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		deletedAt: integer("deleted_at", { mode: "timestamp" }),
	},
	(table) => [
		unique().on(table.namespace, table.key),
		index("idx_meters_namespace_key").on(table.namespace, table.key),
		index("idx_meters_event_type").on(table.eventType),
	],
);

export const subjects = sqliteTable(
	"subjects",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		namespace: text("namespace").notNull().default("default"),
		key: text("key").notNull(),
		displayName: text("display_name"),
		metadata: text("metadata", { mode: "json" }).$type<Record<string, any>>(),
		stripeCustomerId: text("stripe_customer_id"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		deletedAt: integer("deleted_at", { mode: "timestamp" }),
	},
	(table) => [
		unique().on(table.namespace, table.key),
		index("idx_subjects_namespace_key").on(table.namespace, table.key),
	],
);

export const events = sqliteTable(
	"events",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		meterId: text("meter_id").notNull(),
		subjectId: text("subject_id").notNull(),
		timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
		value: real("value").notNull().default(0),
		properties: text("properties", { mode: "json" }).$type<
			Record<string, any>
		>(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		index("idx_events_meter_subject").on(table.meterId, table.subjectId),
		index("idx_events_timestamp").on(table.timestamp),
		index("idx_events_meter_timestamp").on(table.meterId, table.timestamp),
		foreignKey({
			columns: [table.meterId],
			foreignColumns: [meters.id],
		}),
		foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjects.id],
		}),
	],
);

export const features = sqliteTable(
	"features",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		namespace: text("namespace").notNull().default("default"),
		key: text("key").notNull(),
		name: text("name").notNull(),
		description: text("description"),
		meterId: text("meter_id"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		deletedAt: integer("deleted_at", { mode: "timestamp" }),
	},
	(table) => [
		unique().on(table.namespace, table.key),
		index("idx_features_namespace_key").on(table.namespace, table.key),
		foreignKey({
			columns: [table.meterId],
			foreignColumns: [meters.id],
		}),
	],
);

export const usageAggregates = sqliteTable(
	"usage_aggregates",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		meterId: text("meter_id").notNull(),
		subjectId: text("subject_id").notNull(),
		periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
		periodEnd: integer("period_end", { mode: "timestamp" }).notNull(),
		aggType: text("agg_type", {
			enum: ["SUM", "COUNT", "AVG", "MIN", "MAX", "UNIQUE_COUNT", "LATEST"],
		}).notNull(),
		value: real("value").notNull(),
		groupBy: text("group_by", { mode: "json" }).$type<Record<string, string>>(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.$defaultFn(() => new Date()),
	},
	(table) => [
		unique().on(
			table.meterId,
			table.subjectId,
			table.periodStart,
			table.periodEnd,
			table.aggType,
			table.groupBy,
		),
		index("idx_usage_aggregates_meter_subject").on(
			table.meterId,
			table.subjectId,
		),
		index("idx_usage_aggregates_period").on(table.periodStart, table.periodEnd),
		foreignKey({
			columns: [table.meterId],
			foreignColumns: [meters.id],
		}),
		foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjects.id],
		}),
	],
);

// Database service class
export class DatabaseService {
	private db: ReturnType<typeof drizzle>;

	constructor(d1Database: D1Database) {
		this.db = drizzle(d1Database);
	}

	// Get the Drizzle database instance
	get database() {
		return this.db;
	}

	// Health check
	async healthCheck(): Promise<boolean> {
		try {
			await this.db.run(sql`SELECT 1`);
			return true;
		} catch (error) {
			console.error("Database health check failed:", error);
			return false;
		}
	}

	// Run migrations
	async migrate(): Promise<void> {
		// In production, migrations should be run via wrangler CLI
		// This is a placeholder for potential development migrations
		try {
			// Basic table existence check
			await this.db.run(sql`
        CREATE TABLE IF NOT EXISTS _migration_status (
          version TEXT PRIMARY KEY,
          applied_at INTEGER NOT NULL DEFAULT (unixepoch())
        )
      `);
		} catch (error) {
			console.error("Migration check failed:", error);
			throw error;
		}
	}
}

// Export database instance creator
export function createDatabaseService(env: Env): DatabaseService {
	return new DatabaseService(env.D1_DB);
}

// Type exports for use in other files
export type MetersTable = typeof meters;
export type SubjectsTable = typeof subjects;
export type EventsTable = typeof events;
export type FeaturesTable = typeof features;
export type UsageAggregatesTable = typeof usageAggregates;
