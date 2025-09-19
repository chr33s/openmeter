import { getConfigValue } from "./config";

// API client for OpenMeter endpoints using fetch
export interface MeterQueryParams {
	meterId?: string;
	subjectId?: string;
	from?: string;
	to?: string;
	windowSize?: "MINUTE" | "HOUR" | "DAY" | "MONTH";
	windowTimeZone?: string;
	groupBy?: string[];
}

export interface UsageQueryParams extends MeterQueryParams {
	page?: number;
	pageSize?: number;
}

export interface EventsQueryParams {
	page?: number;
	pageSize?: number;
	meterId?: string;
	subjectId?: string;
	from?: string;
	to?: string;
}

export interface MeterQueryRow {
	windowStart: string;
	windowEnd: string;
	value: number;
	subject?: string;
}

export interface MeterQueryResult {
	meterId: string;
	from: string;
	to: string;
	windowSize: string;
	data: MeterQueryRow[];
}

export interface UsageReport {
	usage: number;
	period: string;
	meterId?: string;
	subjectId?: string;
}

export interface Event {
	id: string;
	subjectId: string;
	meterId: string;
	timestamp: string;
	properties?: Record<string, any>;
	value?: number;
}

export interface Meter {
	id: string;
	namespace: string;
	slug: string;
	displayName?: string;
	description?: string;
	aggregation: string;
	windowSize: string;
	createdAt: string;
	updatedAt: string;
}

export interface Subject {
	id: string;
	namespace: string;
	key: string;
	displayName?: string;
	metadata?: Record<string, any>;
	createdAt: string;
	updatedAt: string;
}

export interface Entitlement {
	id: string;
	subjectId: string;
	featureId: string;
	value: number;
	type: string;
	usageLimit?: number;
	period?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Plan {
	id: string;
	name: string;
	description?: string;
	features: string[];
	pricing?: Record<string, any>;
	createdAt: string;
	updatedAt: string;
}

export interface PaginationResponse<T> {
	data: T[];
	totalCount: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}

class ApiError extends Error {
	constructor(
		public status: number,
		message: string,
		public response?: any,
	) {
		super(message);
		this.name = "ApiError";
	}
}

class ApiClient {
	private baseUrl: string;
	private apiKey: string | null = null;
	private abortController: AbortController | null = null;

	constructor(baseUrl = "") {
		this.baseUrl = baseUrl;
		// Get API key from configuration
		this.apiKey = getConfigValue("API_KEY") || null;
	}

	/**
	 * Set API key manually if not available from environment
	 */
	setApiKey(apiKey: string): void {
		this.apiKey = apiKey;
	}

	/**
	 * Get current API key
	 */
	getApiKey(): string | null {
		return this.apiKey;
	}

	private async request<T>(
		endpoint: string,
		options: RequestInit = {},
	): Promise<T> {
		const url = `${this.baseUrl}${endpoint}`;

		// Create a new abort controller for this request
		this.abortController = new AbortController();

		// Build headers with authentication
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			...options.headers,
		};

		// Add API key authentication if available
		if (this.apiKey) {
			headers["x-api-key"] = this.apiKey;
		}

		const response = await fetch(url, {
			...options,
			signal: this.abortController.signal,
			headers,
		});

		if (!response.ok) {
			let errorData;
			try {
				errorData = await response.json();
			} catch {
				errorData = { message: response.statusText };
			}

			// Provide more specific error messages for authentication issues
			if (response.status === 401) {
				const message = this.apiKey
					? "Invalid or expired API key"
					: "Authentication required - API key not configured";
				throw new ApiError(response.status, message, errorData);
			}

			if (response.status === 403) {
				throw new ApiError(
					response.status,
					"Insufficient permissions for this operation",
					errorData,
				);
			}

			if (response.status === 429) {
				throw new ApiError(
					response.status,
					"Rate limit exceeded - too many requests",
					errorData,
				);
			}

			throw new ApiError(
				response.status,
				errorData.message || "API request failed",
				errorData,
			);
		}

		return response.json();
	}

	private buildQuery(params: Record<string, any>): string {
		const searchParams = new URLSearchParams();
		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				if (Array.isArray(value)) {
					value.forEach((v) => searchParams.append(key, v.toString()));
				} else {
					searchParams.append(key, value.toString());
				}
			}
		});
		return searchParams.toString();
	}

	// Usage endpoints
	async getUsage(params: UsageQueryParams = {}): Promise<MeterQueryResult> {
		const query = this.buildQuery(params);
		return this.request<MeterQueryResult>(`/api/v1/usage/query?${query}`);
	}

	async getUsageReport(params: UsageQueryParams = {}): Promise<UsageReport> {
		const query = this.buildQuery(params);
		return this.request<UsageReport>(`/api/v1/usage/report?${query}`);
	}

	// Events endpoints
	async getEvents(
		params: EventsQueryParams = {},
	): Promise<PaginationResponse<Event>> {
		const query = this.buildQuery(params);
		return this.request<PaginationResponse<Event>>(`/api/v1/events?${query}`);
	}

	async createEvent(event: Omit<Event, "id">): Promise<Event> {
		return this.request<Event>("/api/v1/events", {
			method: "POST",
			body: JSON.stringify(event),
		});
	}

	// Meters endpoints
	async getMeters(
		params: { search?: string; page?: number; pageSize?: number } = {},
	): Promise<PaginationResponse<Meter>> {
		const query = this.buildQuery(params);
		return this.request<PaginationResponse<Meter>>(`/api/v1/meters?${query}`);
	}

	async getMeter(id: string): Promise<Meter> {
		return this.request<Meter>(`/api/v1/meters/${id}`);
	}

	async queryMeter(
		id: string,
		params: MeterQueryParams,
	): Promise<MeterQueryResult> {
		const query = this.buildQuery(params);
		return this.request<MeterQueryResult>(
			`/api/v1/meters/${id}/query?${query}`,
		);
	}

	// Subjects endpoints
	async getSubjects(
		params: { search?: string; page?: number; pageSize?: number } = {},
	): Promise<PaginationResponse<Subject>> {
		const query = this.buildQuery(params);
		return this.request<PaginationResponse<Subject>>(
			`/api/v1/subjects?${query}`,
		);
	}

	async getSubject(id: string): Promise<Subject> {
		return this.request<Subject>(`/api/v1/subjects/${id}`);
	}

	// Entitlements endpoints (placeholder - would need actual endpoint structure)
	async getEntitlements(
		params: { subjectId?: string; page?: number; pageSize?: number } = {},
	): Promise<PaginationResponse<Entitlement>> {
		const query = this.buildQuery(params);
		// Note: This endpoint may not exist in the actual API, using as placeholder
		return this.request<PaginationResponse<Entitlement>>(
			`/api/v1/entitlements?${query}`,
		);
	}

	// Plans endpoints (placeholder)
	async getPlans(
		params: { page?: number; pageSize?: number } = {},
	): Promise<PaginationResponse<Plan>> {
		const query = this.buildQuery(params);
		// Note: This endpoint may not exist in the actual API, using as placeholder
		return this.request<PaginationResponse<Plan>>(`/api/v1/plans?${query}`);
	}

	// Utility method to abort ongoing requests
	abort(): void {
		if (this.abortController) {
			this.abortController.abort();
		}
	}
}

// Export a singleton instance
export const apiClient = new ApiClient();

// Export the class for testing or custom instances
export { ApiClient, ApiError };
