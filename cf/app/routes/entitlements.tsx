import { useState, useEffect } from "react";

import { apiClient, Entitlement, PaginationResponse } from "#app/api";
import { Card } from "#app/components/card";
import { Table, Pagination } from "#app/components/table";
import {
	LoadingState,
	ErrorState,
	EmptyState,
} from "#app/components/loading-error";

export function Entitlements() {
	const [entitlements, setEntitlements] =
		useState<PaginationResponse<Entitlement> | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [currentPage, setCurrentPage] = useState(1);
	const [filters, setFilters] = useState({
		subjectId: "customer-1",
		pageSize: 25,
	});

	useEffect(() => {
		void loadEntitlements();
	}, [currentPage]);

	const loadEntitlements = async () => {
		try {
			setLoading(true);
			setError(null);

			// Note: This endpoint may not exist in the actual API
			// This is a placeholder implementation
			const result = await apiClient.getEntitlements({
				...filters,
				page: currentPage,
			});

			setEntitlements(result);
		} catch (err) {
			// If the endpoint doesn't exist, show a placeholder message
			if (err instanceof Error && err.message.includes("404")) {
				setError("Entitlements endpoint is not yet implemented in the API");
			} else {
				setError(
					err instanceof Error ? err.message : "Failed to load entitlements",
				);
			}
		} finally {
			setLoading(false);
		}
	};

	const handleFilterChange = (key: string, value: string) => {
		setFilters((prev) => ({ ...prev, [key]: value }));
	};

	const applyFilters = () => {
		setCurrentPage(1);
		void loadEntitlements();
	};

	const handlePageChange = (page: number) => {
		setCurrentPage(page);
	};

	const columns = [
		{
			key: "id",
			header: "Entitlement ID",
			render: (value: string) => (
				<code className="text-xs bg-gray-100 px-2 py-1 rounded">
					{value.length > 12 ? `${value.slice(0, 12)}...` : value}
				</code>
			),
			width: "15%",
		},
		{
			key: "subjectId",
			header: "Subject",
			width: "15%",
		},
		{
			key: "featureId",
			header: "Feature",
			width: "15%",
		},
		{
			key: "type",
			header: "Type",
			render: (value: string) => (
				<span
					className={`px-2 py-1 rounded-full text-xs font-medium ${
						value === "UNLIMITED"
							? "bg-green-100 text-green-800"
							: value === "LIMITED"
								? "bg-yellow-100 text-yellow-800"
								: "bg-gray-100 text-gray-800"
					}`}
				>
					{value}
				</span>
			),
			width: "10%",
		},
		{
			key: "value",
			header: "Value",
			render: (value: number) => value.toLocaleString(),
			width: "10%",
		},
		{
			key: "usageLimit",
			header: "Usage Limit",
			render: (value?: number) =>
				value !== undefined ? value.toLocaleString() : "Unlimited",
			width: "15%",
		},
		{
			key: "period",
			header: "Period",
			render: (value?: string) => value || "N/A",
			width: "10%",
		},
		{
			key: "createdAt",
			header: "Created",
			render: (value: string) => new Date(value).toLocaleDateString(),
			width: "10%",
		},
	];

	const totalPages = entitlements
		? Math.ceil(entitlements.totalCount / filters.pageSize)
		: 0;

	// If endpoint doesn't exist, show placeholder content
	if (error && error.includes("not yet implemented")) {
		return (
			<div className="space-y-6">
				<div>
					<h1 className="text-2xl font-bold text-gray-900 mb-2">
						Entitlements
					</h1>
					<p className="text-gray-600">
						Manage feature access and usage limits for customers.
					</p>
				</div>

				<Card>
					<EmptyState
						title="Entitlements Not Available"
						message="The entitlements endpoint is not yet implemented in this Cloudflare API. This is a placeholder for the entitlements feature that would manage customer access to features and usage limits."
						action={
							<div className="space-y-4">
								<div className="text-sm text-gray-600 max-w-md mx-auto">
									In a full implementation, this page would show:
									<ul className="list-disc list-inside mt-2 space-y-1">
										<li>Customer feature entitlements</li>
										<li>Usage limits and quotas</li>
										<li>Entitlement types (unlimited, limited)</li>
										<li>Billing periods and resets</li>
										<li>Current usage vs. limits</li>
									</ul>
								</div>
								<button
									onClick={loadEntitlements}
									className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
								>
									Retry Loading
								</button>
							</div>
						}
					/>
				</Card>

				{/* Mock Example Data */}
				<Card title="Example Entitlements (Mock Data)">
					<Table
						data={[
							{
								id: "ent_123456",
								subjectId: "customer-1",
								featureId: "api_calls",
								type: "LIMITED",
								value: 1000,
								usageLimit: 1000,
								period: "MONTH",
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							},
							{
								id: "ent_789012",
								subjectId: "customer-1",
								featureId: "storage",
								type: "LIMITED",
								value: 5,
								usageLimit: 5,
								period: "MONTH",
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							},
							{
								id: "ent_345678",
								subjectId: "customer-1",
								featureId: "premium_support",
								type: "UNLIMITED",
								value: 1,
								usageLimit: undefined,
								period: undefined,
								createdAt: new Date().toISOString(),
								updatedAt: new Date().toISOString(),
							},
						]}
						columns={columns}
						emptyMessage="No entitlements found"
					/>
					<div className="mt-4 text-sm text-gray-500 italic">
						* This is example data to demonstrate the entitlements interface
					</div>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="text-2xl font-bold text-gray-900 mb-2">Entitlements</h1>
				<p className="text-gray-600">
					Manage feature access and usage limits for customers.
				</p>
			</div>

			{/* Filters */}
			<Card title="Filters">
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Subject ID
						</label>
						<input
							type="text"
							value={filters.subjectId}
							onChange={(e) => handleFilterChange("subjectId", e.target.value)}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							placeholder="Filter by subject ID"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">
							Page Size
						</label>
						<select
							value={filters.pageSize}
							onChange={(e) => handleFilterChange("pageSize", e.target.value)}
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
						onClick={applyFilters}
						disabled={loading}
						className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors duration-200"
					>
						Apply Filters
					</button>
					<button
						onClick={loadEntitlements}
						disabled={loading}
						className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors duration-200"
					>
						Refresh
					</button>
				</div>
			</Card>

			{error && !error.includes("not yet implemented") && (
				<ErrorState error={error} onRetry={loadEntitlements} />
			)}

			{/* Entitlements Table */}
			<div>
				{loading ? (
					<LoadingState message="Loading entitlements..." />
				) : entitlements && entitlements.data.length > 0 ? (
					<div className="space-y-4">
						<Card
							title={`Entitlements (${entitlements.totalCount.toLocaleString()} total)`}
						>
							<Table
								data={entitlements.data}
								columns={columns}
								emptyMessage="No entitlements found for the selected filters"
							/>
						</Card>

						{totalPages > 1 && (
							<Pagination
								currentPage={currentPage}
								totalPages={totalPages}
								onPageChange={handlePageChange}
								hasNextPage={entitlements.hasNextPage}
								hasPreviousPage={entitlements.hasPreviousPage}
							/>
						)}
					</div>
				) : (
					<Card>
						<EmptyState
							title="No Entitlements Found"
							message="No entitlements found for the selected subject. This could mean the customer doesn't have any active entitlements."
						/>
					</Card>
				)}
			</div>

			{/* Summary */}
			{entitlements && entitlements.data.length > 0 && (
				<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
					<Card title="Total Entitlements">
						<div className="text-2xl font-bold text-blue-600">
							{entitlements.totalCount.toLocaleString()}
						</div>
					</Card>

					<Card title="Limited">
						<div className="text-2xl font-bold text-yellow-600">
							{entitlements.data.filter((e) => e.type === "LIMITED").length}
						</div>
					</Card>

					<Card title="Unlimited">
						<div className="text-2xl font-bold text-green-600">
							{entitlements.data.filter((e) => e.type === "UNLIMITED").length}
						</div>
					</Card>

					<Card title="Features">
						<div className="text-2xl font-bold text-purple-600">
							{new Set(entitlements.data.map((e) => e.featureId)).size}
						</div>
					</Card>
				</div>
			)}
		</div>
	);
}
