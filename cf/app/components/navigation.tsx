import { Link, useLocation } from "react-router";
import { apiClient } from "#app/api";

interface NavigationItem {
	path: string;
	label: string;
	icon?: string;
}

const navigationItems: NavigationItem[] = [
	{ path: "/", label: "Dashboard", icon: "📊" },
	{ path: "/usage", label: "Usage", icon: "📈" },
	{ path: "/events", label: "Events", icon: "📋" },
	{ path: "/entitlements", label: "Entitlements", icon: "🔒" },
	{ path: "/plans", label: "Plans", icon: "📦" },
];

export function Navigation() {
	const location = useLocation();

	return (
		<nav className="bg-white shadow-lg border-r border-gray-200 h-full">
			<div className="p-6">
				<h1 className="text-xl font-bold text-sky-700 mb-8">
					OpenMeter Dashboard
				</h1>
				<ul className="space-y-2">
					{navigationItems.map((item) => {
						const isActive = location.pathname === item.path;
						return (
							<li key={item.path}>
								<Link
									to={item.path}
									className={`flex items-center space-x-3 px-4 py-2 rounded-lg transition-colors duration-200 ${
										isActive
											? "bg-sky-100 text-sky-700 font-semibold"
											: "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
									}`}
								>
									{item.icon && <span className="text-lg">{item.icon}</span>}
									<span>{item.label}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			</div>
		</nav>
	);
}

export function Header() {
	const apiKey = apiClient.getApiKey();
	const hasApiKey = !!apiKey;
	const maskedApiKey = apiKey?.substring(0, 8) + "...";

	return (
		<header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
			<div className="flex items-center justify-between">
				<h2 className="text-lg font-semibold text-gray-800">
					Customer Dashboard
				</h2>
				<div className="flex items-center space-x-4 text-sm text-gray-600">
					<div>
						<span className="font-medium">Subject:</span> customer-1
					</div>
					<div>
						<span className="font-medium">Environment:</span> {__ENVIRONMENT__}
					</div>
					<div className="flex items-center space-x-2">
						<span className="font-medium">API Auth:</span>
						<div
							className={`flex items-center space-x-1 px-2 py-1 rounded text-xs ${
								hasApiKey
									? "text-green-600 bg-green-50"
									: "text-red-600 bg-red-50"
							}`}
							title={
								hasApiKey
									? "API key configured at build time"
									: "No API key configured"
							}
						>
							<span
								className={`w-2 h-2 rounded-full ${
									hasApiKey ? "bg-green-500" : "bg-red-500"
								}`}
							></span>
							<span>{hasApiKey ? maskedApiKey : "No API Key"}</span>
						</div>
					</div>
				</div>
			</div>
		</header>
	);
}
