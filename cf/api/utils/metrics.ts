// Metrics and monitoring utilities

export interface MetricCounter {
	name: string;
	value: number;
	labels?: Record<string, string>;
	timestamp: number;
}

export interface MetricGauge {
	name: string;
	value: number;
	labels?: Record<string, string>;
	timestamp: number;
}

export interface MetricHistogram {
	name: string;
	value: number;
	labels?: Record<string, string>;
	timestamp: number;
}

export class MetricsCollector {
	private counters: Map<string, MetricCounter> = new Map();
	private gauges: Map<string, MetricGauge> = new Map();
	private histograms: MetricHistogram[] = [];

	// Increment counter
	incrementCounter(
		name: string,
		value: number = 1,
		labels?: Record<string, string>,
	): void {
		const key = this.createKey(name, labels);
		const existing = this.counters.get(key);

		if (existing) {
			existing.value += value;
			existing.timestamp = Date.now();
		} else {
			this.counters.set(key, {
				name,
				value,
				labels,
				timestamp: Date.now(),
			});
		}
	}

	// Set gauge value
	setGauge(name: string, value: number, labels?: Record<string, string>): void {
		const key = this.createKey(name, labels);
		this.gauges.set(key, {
			name,
			value,
			labels,
			timestamp: Date.now(),
		});
	}

	// Record histogram value
	recordHistogram(
		name: string,
		value: number,
		labels?: Record<string, string>,
	): void {
		this.histograms.push({
			name,
			value,
			labels,
			timestamp: Date.now(),
		});
	}

	// Get all metrics
	getAllMetrics(): {
		counters: MetricCounter[];
		gauges: MetricGauge[];
		histograms: MetricHistogram[];
	} {
		return {
			counters: Array.from(this.counters.values()),
			gauges: Array.from(this.gauges.values()),
			histograms: [...this.histograms],
		};
	}

	// Clear all metrics
	clear(): void {
		this.counters.clear();
		this.gauges.clear();
		this.histograms.length = 0;
	}

	// Create unique key for metric
	private createKey(name: string, labels?: Record<string, string>): string {
		if (!labels || Object.keys(labels).length === 0) {
			return name;
		}

		const labelString = Object.entries(labels)
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, value]) => `${key}=${value}`)
			.join(",");

		return `${name}{${labelString}}`;
	}
}

// Application metrics
export class ApplicationMetrics {
	private collector: MetricsCollector;

	constructor() {
		this.collector = new MetricsCollector();
	}

	// HTTP request metrics
	recordHttpRequest(
		method: string,
		path: string,
		status: number,
		duration: number,
	): void {
		const labels = { method, path, status: status.toString() };

		this.collector.incrementCounter("http_requests_total", 1, labels);
		this.collector.recordHistogram(
			"http_request_duration_ms",
			duration,
			labels,
		);

		if (status >= 400) {
			this.collector.incrementCounter("http_errors_total", 1, labels);
		}
	}

	// Database operation metrics
	recordDbOperation(
		operation: string,
		table: string,
		duration: number,
		success: boolean,
	): void {
		const labels = {
			operation,
			table,
			status: success ? "success" : "error",
		};

		this.collector.incrementCounter("db_operations_total", 1, labels);
		this.collector.recordHistogram(
			"db_operation_duration_ms",
			duration,
			labels,
		);
	}

	// Cache operation metrics
	recordCacheOperation(
		operation: "hit" | "miss" | "set" | "delete",
		key: string,
	): void {
		const labels = { operation, key_type: this.extractKeyType(key) };

		this.collector.incrementCounter("cache_operations_total", 1, labels);

		if (operation === "hit" || operation === "miss") {
			this.collector.incrementCounter("cache_requests_total", 1, labels);
		}
	}

	// Rate limit metrics
	recordRateLimit(allowed: boolean, remaining: number): void {
		const labels = { allowed: allowed.toString() };

		this.collector.incrementCounter("rate_limit_checks_total", 1, labels);
		this.collector.setGauge("rate_limit_remaining", remaining);
	}

	// Authentication metrics
	recordAuth(method: "api-key" | "jwt", success: boolean): void {
		const labels = { method, status: success ? "success" : "failure" };

		this.collector.incrementCounter("auth_attempts_total", 1, labels);
	}

	// AI operation metrics
	recordAIOperation(model: string, duration: number, success: boolean): void {
		const labels = {
			model: this.normalizeModelName(model),
			status: success ? "success" : "error",
		};

		this.collector.incrementCounter("ai_operations_total", 1, labels);
		this.collector.recordHistogram(
			"ai_operation_duration_ms",
			duration,
			labels,
		);
	}

	// Event ingestion metrics
	recordEventIngestion(
		type: "single" | "batch",
		count: number,
		duration: number,
		processed: number,
		failed: number,
	): void {
		const labels = { type };

		this.collector.incrementCounter("events_ingested_total", processed, labels);
		this.collector.incrementCounter("events_failed_total", failed, labels);
		this.collector.recordHistogram(
			"event_ingestion_duration_ms",
			duration,
			labels,
		);

		if (type === "batch") {
			this.collector.setGauge("batch_size_current", count);
		}
	}

	// System resource metrics
	recordSystemMetrics(memoryUsage?: number): void {
		if (memoryUsage) {
			this.collector.setGauge("memory_usage_bytes", memoryUsage);
		}

		this.collector.setGauge("uptime_seconds", Date.now() / 1000);
	}

	// Get metrics in Prometheus format
	getPrometheusMetrics(): string {
		const metrics = this.collector.getAllMetrics();
		const lines: string[] = [];

		// Counters
		for (const counter of metrics.counters) {
			const labelsStr = this.formatLabels(counter.labels);
			lines.push(`${counter.name}${labelsStr} ${counter.value}`);
		}

		// Gauges
		for (const gauge of metrics.gauges) {
			const labelsStr = this.formatLabels(gauge.labels);
			lines.push(`${gauge.name}${labelsStr} ${gauge.value}`);
		}

		// Histograms (simplified as individual points)
		for (const histogram of metrics.histograms) {
			const labelsStr = this.formatLabels(histogram.labels);
			lines.push(`${histogram.name}${labelsStr} ${histogram.value}`);
		}

		return lines.join("\n") + "\n";
	}

	// Get metrics summary
	getMetricsSummary(): Record<string, any> {
		const metrics = this.collector.getAllMetrics();

		return {
			counters: metrics.counters.length,
			gauges: metrics.gauges.length,
			histograms: metrics.histograms.length,
			timestamp: new Date().toISOString(),
		};
	}

	// Clear all metrics
	clear(): void {
		this.collector.clear();
	}

	// Helper methods
	private extractKeyType(key: string): string {
		const parts = key.split(":");
		return parts.length > 0 ? parts[0] || "unknown" : "unknown";
	}

	private normalizeModelName(model: string): string {
		// Extract model name from CF AI model identifier
		const parts = model.split("/");
		return parts.length > 0 ? parts[parts.length - 1] || model : model;
	}

	private formatLabels(labels?: Record<string, string>): string {
		if (!labels || Object.keys(labels).length === 0) {
			return "";
		}

		const labelPairs = Object.entries(labels)
			.map(([key, value]) => `${key}="${value}"`)
			.join(",");

		return `{${labelPairs}}`;
	}
}

// Global metrics instance
export const metrics = new ApplicationMetrics();
