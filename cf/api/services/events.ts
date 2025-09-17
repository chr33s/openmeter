import { eq, and, gte, lte, desc } from "drizzle-orm";
import type { DatabaseService } from "#/services/database";
import { events, subjects, meters } from "#/services/database";
import type {
	IngestEventRequest,
	BatchIngestEventRequest,
	Event,
	Subject,
	Meter,
} from "#/types";

export class EventsService {
	constructor(private db: DatabaseService) {}

	// Ingest a single event
	async ingestEvent(
		namespace: string,
		eventData: IngestEventRequest,
	): Promise<{ eventId: string; processed: boolean }> {
		const database = this.db.database;

		try {
			// Find or create subject
			const subject = await this.findOrCreateSubject(
				namespace,
				eventData.subject,
			);

			// Find meter by event type
			const meter = await this.findMeterByEventType(namespace, eventData.type);
			if (!meter) {
				throw new Error(`No meter found for event type: ${eventData.type}`);
			}

			// Extract value from event
			const value = this.extractEventValue(eventData, meter);

			// Create event record
			const timestamp = eventData.timestamp
				? new Date(eventData.timestamp)
				: new Date();

			const [insertedEvent] = await database
				.insert(events)
				.values({
					meterId: meter.id,
					subjectId: subject.id,
					timestamp,
					value,
					properties: eventData.properties,
				})
				.returning({ id: events.id });

			return {
				eventId: insertedEvent?.id ?? "unknown",
				processed: true,
			};
		} catch (error) {
			console.error("Event ingestion error:", error);
			throw error;
		}
	}

	// Ingest batch of events
	async ingestBatchEvents(
		namespace: string,
		batchData: BatchIngestEventRequest,
	): Promise<{
		totalEvents: number;
		processedEvents: number;
		failedEvents: number;
		errors: string[];
	}> {
		const results = {
			totalEvents: batchData.events.length,
			processedEvents: 0,
			failedEvents: 0,
			errors: [] as string[],
		};

		// Process events in chunks to avoid overwhelming the database
		const chunkSize = 100;
		for (let i = 0; i < batchData.events.length; i += chunkSize) {
			const chunk = batchData.events.slice(i, i + chunkSize);

			for (const eventData of chunk) {
				try {
					await this.ingestEvent(namespace, eventData);
					results.processedEvents++;
				} catch (error) {
					results.failedEvents++;
					results.errors.push(
						`Event ${i + chunk.indexOf(eventData)}: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
				}
			}
		}

		return results;
	}

	// Query events
	async queryEvents(params: {
		namespace: string;
		meterId?: string;
		subjectId?: string;
		from?: Date;
		to?: Date;
		limit?: number;
		offset?: number;
	}): Promise<{ events: Event[]; totalCount: number }> {
		const database = this.db.database;
		const { meterId, subjectId, from, to, limit = 100, offset = 0 } = params;

		try {
			// Build query conditions
			const conditions = [];

			if (meterId) {
				conditions.push(eq(events.meterId, meterId));
			}

			if (subjectId) {
				conditions.push(eq(events.subjectId, subjectId));
			}

			if (from) {
				conditions.push(gte(events.timestamp, from));
			}

			if (to) {
				conditions.push(lte(events.timestamp, to));
			}

			// Query events
			const eventsQuery = database
				.select()
				.from(events)
				.where(and(...conditions))
				.orderBy(desc(events.timestamp))
				.limit(limit)
				.offset(offset);

			const eventsResult = await eventsQuery;

			// Count total events (simplified - in production you might want to optimize this)
			const countQuery = database
				.select({ count: events.id })
				.from(events)
				.where(and(...conditions));

			const countResult = await countQuery;
			const totalCount = countResult.length;

			return {
				events: eventsResult.map((event) => ({
					id: event.id,
					meterId: event.meterId,
					subjectId: event.subjectId,
					timestamp: event.timestamp,
					value: event.value,
					properties: event.properties || undefined,
				})),
				totalCount,
			};
		} catch (error) {
			console.error("Events query error:", error);
			throw error;
		}
	}

	// Find or create subject
	private async findOrCreateSubject(
		namespace: string,
		subjectKey: string,
	): Promise<Subject> {
		const database = this.db.database;

		try {
			// Try to find existing subject
			const existingSubjects = await database
				.select()
				.from(subjects)
				.where(
					and(eq(subjects.namespace, namespace), eq(subjects.key, subjectKey)),
				)
				.limit(1);

			if (existingSubjects.length > 0) {
				return existingSubjects[0] as Subject;
			}

			// Create new subject
			const [newSubject] = await database
				.insert(subjects)
				.values({
					namespace,
					key: subjectKey,
					displayName: subjectKey,
				})
				.returning();

			return newSubject as Subject;
		} catch (error) {
			console.error("Subject find/create error:", error);
			throw error;
		}
	}

	// Find meter by event type
	private async findMeterByEventType(
		namespace: string,
		eventType: string,
	): Promise<Meter | null> {
		const database = this.db.database;

		try {
			const metersResult = await database
				.select()
				.from(meters)
				.where(
					and(eq(meters.namespace, namespace), eq(meters.eventType, eventType)),
				)
				.limit(1);

			return metersResult.length > 0 ? (metersResult[0] as Meter) : null;
		} catch (error) {
			console.error("Meter find error:", error);
			throw error;
		}
	}

	// Extract value from event based on meter configuration
	private extractEventValue(
		eventData: IngestEventRequest,
		meter: Meter,
	): number {
		// If meter has value property configured, extract from properties
		if (meter.valueProperty && eventData.properties) {
			const value = eventData.properties[meter.valueProperty];
			if (typeof value === "number") {
				return value;
			}
			if (typeof value === "string") {
				const parsed = parseFloat(value);
				if (!isNaN(parsed)) {
					return parsed;
				}
			}
		}

		// Use explicit value if provided
		if (eventData.value !== undefined) {
			return eventData.value;
		}

		// Default to 1 for count-based aggregations
		if (meter.aggregation === "COUNT") {
			return 1;
		}

		// Default to 0 for other aggregations
		return 0;
	}
}

export function createEventsService(db: DatabaseService): EventsService {
	return new EventsService(db);
}
