import { useState, useEffect } from "react";

import { apiClient, Plan, PaginationResponse } from "#/lib/api";
import { Card } from "#/components/card";
import { Table, Pagination } from "#/components/table";
import {
	LoadingState,
	ErrorState,
	EmptyState,
} from "#/components/loading-error";

export function Plans() {
	const [plans, setPlans] = useState<PaginationResponse<Plan> | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(25);

	useEffect(() => {
		loadPlans();
	}, [currentPage, pageSize]);

	const loadPlans = async () => {
		try {
			setLoading(true);
			setError(null);

			// Note: This endpoint may not exist in the actual API
			// This is a placeholder implementation
			const result = await apiClient.getPlans({
				page: currentPage,
				pageSize,
			});

			setPlans(result);
		} catch (err) {
			// If the endpoint doesn't exist, show a placeholder message
			if (err instanceof Error && err.message.includes("404")) {
				setError("Plans endpoint is not yet implemented in the API");
			} else {
				setError(err instanceof Error ? err.message : "Failed to load plans");
			}
		} finally {
			setLoading(false);
		}
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const columns = [
		{
			key: "id",
			header: "Plan ID",
			render: (value: string) => (
				<code className="text-xs bg-gray-100 px-2 py-1 rounded">
					{value.length > 12 ? `${value.slice(0, 12)}...` : value}
				</code>
			),
			width: "15%",
		},
		{
			key: "name",
			header: "Plan Name",
			render: (value: string) => (
				<span className="font-medium text-gray-900">{value}</span>
			),
			width: "20%",
		},
		{
			key: "description",
			header: "Description",
			render: (value?: string) => (
				<span className="text-gray-600">{value || "No description"}</span>
			),
			width: "25%",
		},
		{
			key: "features",
			header: "Features",
			render: (value: string[]) => (
				<div className="space-y-1">
					{value.slice(0, 3).map((feature, index) => (
						<span
							key={index}
							className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-1"
						>
							{feature}
						</span>
					))}
					{value.length > 3 && (
						<span className="text-xs text-gray-500">
							+{value.length - 3} more
						</span>
					)}
				</div>
			),
			width: "25%",
		},
		{
			key: "createdAt",
			header: "Created",
			render: (value: string) => new Date(value).toLocaleDateString(),
			width: "15%",
		},
	];

	const totalPages = plans ? Math.ceil(plans.totalCount / pageSize) : 0;

	// If endpoint doesn't exist, show placeholder content
	if (error && error.includes("not yet implemented")) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900 mb-2">Plans</h1>
					<p className="text-gray-600">
						Manage subscription plans and pricing tiers.
					</p>
				</div>

				<Card>
					<EmptyState
						title="Plans Not Available"
						message="The plans endpoint is not yet implemented in this Cloudflare API. This is a placeholder for the plans feature that would manage subscription plans and pricing tiers."
						action={
							<div className="space-y-4">
								<div className="text-sm text-gray-600 max-w-md mx-auto">
									In a full implementation, this page would show:
									<ul className="list-disc list-inside mt-2 space-y-1">
										<li>Available subscription plans</li>
										<li>Pricing tiers and features</li>
										<li>Plan entitlements and limits</li>
										<li>Customer plan assignments</li>
										<li>Plan usage and billing information</li>
									</ul>
								</div>
								<button
									onClick={loadPlans}
									className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
								>
									Retry Loading
								</button>
							</div>
						}
					/>
				</Card>

				{/* Mock Example Data */}
				<Card title="Example Plans (Mock Data)">
					<Table
						data={[
							{
								id: "plan_starter",
								name: "Starter",
								description: "Perfect for small projects and prototypes",
								features: [
									"10,000 API calls/month",
									"1GB storage",
									"Email support",
								],
								pricing: { amount: 0, currency: "USD", interval: "month" },
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							},
							{
								id: "plan_pro",
								name: "Professional",
								description: "Ideal for growing businesses and teams",
								features: [
									"100,000 API calls/month",
									"10GB storage",
									"Priority support",
									"Custom integrations",
								],
								pricing: { amount: 29, currency: "USD", interval: "month" },
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							},
							{
								id: "plan_enterprise",
								name: "Enterprise",
								description: "For large organizations with advanced needs",
								features: [
									"Unlimited API calls",
									"Unlimited storage",
									"24/7 support",
									"Custom SLA",
									"On-premise deployment",
								],
								pricing: { amount: 299, currency: "USD", interval: "month" },
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							},
						]}
						columns={columns}
						emptyMessage="No plans found"
					/>
					<div className="mt-4 text-sm text-gray-500 italic">
						* This is example data to demonstrate the plans interface
					</div>
				</Card>

				{/* Plan Comparison */}
				<Card title="Plan Comparison (Example)">
					<div className="overflow-x-auto">
						<table className="w-full border-collapse">
							<thead>
								<tr className="border-b border-gray-200">
									<th className="text-left py-3 px-4 font-medium text-gray-700">
										Feature
									</th>
									<th className="text-center py-3 px-4 font-medium text-gray-700">
										Starter
									</th>
									<th className="text-center py-3 px-4 font-medium text-gray-700">
										Professional
									</th>
									<th className="text-center py-3 px-4 font-medium text-gray-700">
										Enterprise
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-100">
								<tr>
									<td className="py-3 px-4 text-gray-600">API Calls</td>
									<td className="py-3 px-4 text-center">10,000/month</td>
									<td className="py-3 px-4 text-center">100,000/month</td>
									<td className="py-3 px-4 text-center">Unlimited</td>
								</tr>
								<tr>
									<td className="py-3 px-4 text-gray-600">Storage</td>
									<td className="py-3 px-4 text-center">1GB</td>
									<td className="py-3 px-4 text-center">10GB</td>
									<td className="py-3 px-4 text-center">Unlimited</td>
								</tr>
								<tr>
									<td className="py-3 px-4 text-gray-600">Support</td>
									<td className="py-3 px-4 text-center">Email</td>
									<td className="py-3 px-4 text-center">Priority</td>
									<td className="py-3 px-4 text-center">24/7 Dedicated</td>
								</tr>
								<tr>
									<td className="py-3 px-4 text-gray-600">SLA</td>
									<td className="py-3 px-4 text-center">Best effort</td>
									<td className="py-3 px-4 text-center">99.9%</td>
									<td className="py-3 px-4 text-center">Custom</td>
								</tr>
								<tr>
									<td className="py-3 px-4 text-gray-600">Price</td>
									<td className="py-3 px-4 text-center font-bold text-green-600">
										Free
									</td>
									<td className="py-3 px-4 text-center font-bold text-blue-600">
										$29/month
									</td>
									<td className="py-3 px-4 text-center font-bold text-purple-600">
										$299/month
									</td>
								</tr>
							</tbody>
						</table>
					</div>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-gray-900 mb-2">Plans</h1>
				<p className="text-gray-600">
					Manage subscription plans and pricing tiers.
				</p>
			</div>

			{/* Filters */}
			<Card title="Settings">
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Page Size
						</label>
						<select
							value={pageSize}
							onChange={(e) => setPageSize(Number(e.target.value))}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
						>
							<option value={10}>10 per page</option>
							<option value={25}>25 per page</option>
							<option value={50}>50 per page</option>
							<option value={100}>100 per page</option>
						</select>
					</div>
				</div>

				<div className="mt-4 flex space-x-3">
					<button
						onClick={loadPlans}
						disabled={loading}
						className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
					>
						Refresh
					</button>
				</div>
			</Card>

			{error && !error.includes("not yet implemented") && (
				<ErrorState error={error} onRetry={loadPlans} />
			)}

			{/* Plans Table */}
			<div>
				{loading ? (
					<LoadingState message="Loading plans..." />
				) : plans && plans.data.length > 0 ? (
					<div className="space-y-4">
						<Card title={`Plans (${plans.totalCount.toLocaleString()} total)`}>
							<Table
								data={plans.data}
								columns={columns}
								emptyMessage="No plans found"
							/>
						</Card>

						{totalPages > 1 && (
							<Pagination
								currentPage={currentPage}
								totalPages={totalPages}
								onPageChange={handlePageChange}
								hasNextPage={plans.hasNextPage}
								hasPreviousPage={plans.hasPreviousPage}
							/>
						)}
					</div>
				) : (
					<Card>
						<EmptyState
							title="No Plans Found"
							message="No subscription plans are currently configured."
						/>
					</Card>
				)}
			</div>

			{/* Summary */}
			{plans && plans.data.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<Card title="Total Plans">
						<div className="text-2xl font-bold text-blue-600">
							{plans.totalCount.toLocaleString()}
						</div>
					</Card>

					<Card title="Current Page">
						<div className="text-2xl font-bold text-green-600">
							{currentPage} / {totalPages}
						</div>
					</Card>

					<Card title="Showing">
						<div className="text-2xl font-bold text-orange-600">
							{plans.data.length}
						</div>
					</Card>
				</div>
			)}
		</div>
	);
}
