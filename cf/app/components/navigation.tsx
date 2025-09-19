import { Link, useLocation } from "react-router";
import { useState, useEffect } from "react";
import { getAuthStatus } from "#app/init";
import { ApiKeyManager } from "./api-key-manager";

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
	const [authStatus, setAuthStatus] = useState(getAuthStatus());
	const [showApiKeyManager, setShowApiKeyManager] = useState(false);

	useEffect(() => {
		// Update auth status periodically
		const interval = setInterval(() => {
			setAuthStatus(getAuthStatus());
		}, 5000);

		return () => clearInterval(interval);
	}, []);

	return (
		<>
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
							<span className="font-medium">Environment:</span> Development
						</div>
						<div className="flex items-center space-x-2">
							<span className="font-medium">API Auth:</span>
							<button
								onClick={() => setShowApiKeyManager(true)}
								className={`flex items-center space-x-1 px-2 py-1 rounded text-xs transition-colors ${
									authStatus.hasApiKey
										? "text-green-600 hover:bg-green-50"
										: "text-red-600 hover:bg-red-50 cursor-pointer"
								}`}
								title={
									authStatus.hasApiKey
										? "API key configured - click to manage"
										: "No API key - click to configure"
								}
							>
								<span
									className={`w-2 h-2 rounded-full ${
										authStatus.hasApiKey ? "bg-green-500" : "bg-red-500"
									}`}
								></span>
								<span>
									{authStatus.hasApiKey ? `${authStatus.apiKey}` : "No API Key"}
								</span>
							</button>
						</div>
					</div>
				</div>
			</header>

			{/* API Key Manager Modal */}
			{showApiKeyManager && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
					<ApiKeyManager onClose={() => setShowApiKeyManager(false)} />
				</div>
			)}
		</>
	);
}
