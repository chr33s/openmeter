import React from "react";

interface CardProps {
	title?: string;
	children: React.ReactNode;
	className?: string;
}

export function Card({ title, children, className = "" }: CardProps) {
	return (
		<div className={`bg-white p-6 rounded-lg shadow-lg ${className}`}>
			{title && (
				<h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
			)}
			{children}
		</div>
	);
}

interface MetricCardProps {
	title: string;
	value: string | number;
	subtitle?: string;
	trend?: "up" | "down" | "neutral";
	className?: string;
}

export function MetricCard({
	title,
	value,
	subtitle,
	trend,
	className = "",
}: MetricCardProps) {
	const trendColor = {
		up: "text-green-600",
		down: "text-red-600",
		neutral: "text-gray-600",
	}[trend || "neutral"];

	return (
		<Card className={`${className}`}>
			<div className="space-y-2">
				<h4 className="text-sm font-medium text-gray-600 uppercase tracking-wide">
					{title}
				</h4>
				<div className="text-3xl font-bold text-gray-900">{value}</div>
				{subtitle && <div className={`text-sm ${trendColor}`}>{subtitle}</div>}
			</div>
		</Card>
	);
}
