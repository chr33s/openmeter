import { useState, useEffect } from "react";
import { apiClient, MeterQueryResult, UsageReport } from "#/lib/api";
import { Card, MetricCard } from "#/components/card";
import { Chart } from "#/components/chart";
import { LoadingState, ErrorState } from "#/components/loading-error";

export function Dashboard() {
	const [usageData, setUsageData] = useState<MeterQueryResult | null>(null);
	const [report, setReport] = useState<UsageReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		loadDashboardData();
	}, []);

	const loadDashboardData = async () => {
		try {
			setLoading(true);
			setError(null);

			// Get usage data for the last 30 days
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - 30);

			const [usageResult, reportResult] = await Promise.allSettled([
				apiClient.getUsage({
					from: startDate.toISOString(),
					to: endDate.toISOString(),
					windowSize: "DAY",
					meterId: "m1", // Default meter
					subjectId: "customer-1", // Default subject
				}),
				apiClient.getUsageReport({
					from: startDate.toISOString(),
					to: endDate.toISOString(),
					meterId: "m1",
					subjectId: "customer-1",
				}),
			]);

			if (usageResult.status === "fulfilled") {
				setUsageData(usageResult.value);
			}

			if (reportResult.status === "fulfilled") {
				setReport(reportResult.value);
			}

			// If both failed, show error
			if (
				usageResult.status === "rejected" &&
				reportResult.status === "rejected"
			) {
				throw new Error("Failed to load dashboard data");
			}
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to load dashboard data",
			);
		} finally {
			setLoading(false);
		}
	};

	if (loading) {
		return <LoadingState message="Loading dashboard..." />;
	}

	if (error && !usageData && !report) {
		return <ErrorState error={error} onRetry={loadDashboardData} />;
	}

	// Calculate metrics from usage data
	const totalUsage =
		usageData?.data.reduce((sum, row) => sum + row.value, 0) || 0;
	const averageDaily = usageData?.data.length
		? totalUsage / usageData.data.length
		: 0;
	const lastDayUsage = usageData?.data[usageData.data.length - 1]?.value || 0;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-gray-900 mb-2">
					Dashboard Overview
				</h1>
				<p className="text-gray-600">
					Monitor your usage metrics and track consumption patterns.
				</p>
			</div>

			{/* Metrics Cards */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
				<MetricCard
					title="Total Usage (30d)"
					value={totalUsage.toLocaleString()}
					subtitle="Total events processed"
					trend="neutral"
				/>
				<MetricCard
					title="Daily Average"
					value={Math.round(averageDaily).toLocaleString()}
					subtitle="Events per day"
					trend="neutral"
				/>
				<MetricCard
					title="Last Day"
					value={lastDayUsage.toLocaleString()}
					subtitle="Most recent day"
					trend={
						lastDayUsage > averageDaily
							? "up"
							: lastDayUsage < averageDaily
								? "down"
								: "neutral"
					}
				/>
				<MetricCard
					title="Report Period"
					value={report?.period || "30 days"}
					subtitle="Current tracking period"
					trend="neutral"
				/>
			</div>

			{/* Usage Chart */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<div className="lg:col-span-2">
					{usageData ? (
						<Chart
							data={usageData.data}
							title="Usage Over Time (Last 30 Days)"
							type="bar"
							height={400}
						/>
					) : (
						<Card title="Usage Over Time">
							<div className="text-center text-gray-500 py-8">
								No usage data available
							</div>
						</Card>
					)}
				</div>
			</div>

			{/* Summary Information */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card title="Configuration">
					<div className="space-y-3">
						<div className="flex justify-between">
							<span className="text-sm font-medium text-gray-600">
								Meter ID:
							</span>
							<span className="text-sm text-gray-900">m1</span>
						</div>
						<div className="flex justify-between">
							<span className="text-sm font-medium text-gray-600">
								Subject ID:
							</span>
							<span className="text-sm text-gray-900">customer-1</span>
						</div>
						<div className="flex justify-between">
							<span className="text-sm font-medium text-gray-600">
								Window Size:
							</span>
							<span className="text-sm text-gray-900">DAY</span>
						</div>
						<div className="flex justify-between">
							<span className="text-sm font-medium text-gray-600">
								Date Range:
							</span>
							<span className="text-sm text-gray-900">Last 30 days</span>
						</div>
					</div>
				</Card>

				<Card title="Quick Actions">
					<div className="space-y-3">
						<button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200">
							View Detailed Usage
						</button>
						<button className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200">
							Export Data
						</button>
						<button className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors duration-200">
							Configure Alerts
						</button>
					</div>
				</Card>
			</div>
		</div>
	);
}
