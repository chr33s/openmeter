import React from "react";

interface LoadingSpinnerProps {
	size?: "sm" | "md" | "lg";
	className?: string;
}

export function LoadingSpinner({
	size = "md",
	className = "",
}: LoadingSpinnerProps) {
	const sizeClasses = {
		sm: "w-4 h-4",
		md: "w-6 h-6",
		lg: "w-8 h-8",
	};

	return (
		<div
			className={`animate-spin inline-block ${sizeClasses[size]} border-[3px] border-current border-t-transparent text-blue-600 rounded-full ${className}`}
			role="status"
		>
			<span className="sr-only">Loading...</span>
		</div>
	);
}

interface LoadingStateProps {
	message?: string;
	className?: string;
}

export function LoadingState({
	message = "Loading...",
	className = "",
}: LoadingStateProps) {
	return (
		<div className={`flex items-center justify-center p-8 ${className}`}>
			<LoadingSpinner size="lg" />
			<span className="ml-3 text-gray-600">{message}</span>
		</div>
	);
}

interface ErrorStateProps {
	error: Error | string;
	onRetry?: () => void;
	className?: string;
}

export function ErrorState({
	error,
	onRetry,
	className = "",
}: ErrorStateProps) {
	const message = typeof error === "string" ? error : error.message;

	return (
		<div
			className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}
		>
			<div className="flex items-start space-x-3">
				<div className="text-red-500 text-xl">⚠️</div>
				<div className="flex-1">
					<h3 className="text-red-800 font-semibold mb-2">Error</h3>
					<p className="text-red-700 text-sm mb-4">{message}</p>
					{onRetry && (
						<button
							onClick={onRetry}
							className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200 text-sm"
						>
							Try Again
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

interface EmptyStateProps {
	title?: string;
	message?: string;
	action?: React.ReactNode;
	className?: string;
}

export function EmptyState({
	title = "No data available",
	message = "There is no data to display at this time.",
	action,
	className = "",
}: EmptyStateProps) {
	return (
		<div className={`text-center p-8 ${className}`}>
			<div className="text-6xl mb-4">📊</div>
			<h3 className="text-gray-800 font-semibold text-lg mb-2">{title}</h3>
			<p className="text-gray-600 text-sm mb-4">{message}</p>
			{action && <div className="mt-4">{action}</div>}
		</div>
	);
}
