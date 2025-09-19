import { useState } from "react";
import { configureApiKey, getAuthStatus } from "#app/init";

interface ApiKeyManagerProps {
	onClose?: () => void;
}

export function ApiKeyManager({ onClose }: ApiKeyManagerProps) {
	const [apiKey, setApiKey] = useState("");
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState("");
	const authStatus = getAuthStatus();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!apiKey.trim()) return;

		setLoading(true);
		setMessage("");

		try {
			// Configure the API key
			configureApiKey(apiKey.trim());
			setMessage("API key configured successfully!");

			// Close the dialog after a short delay
			setTimeout(() => {
				onClose?.();
			}, 1500);
		} catch (error) {
			console.error("Failed to configure API key:", error);
			setMessage("Failed to configure API key");
		} finally {
			setLoading(false);
		}
	};

	const handleClear = () => {
		configureApiKey("");
		setApiKey("");
		setMessage("API key cleared");
	};

	return (
		<div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 max-w-md w-full">
			<h3 className="text-lg font-semibold text-gray-800 mb-4">
				API Key Configuration
			</h3>

			<div className="mb-4">
				<div className="flex items-center space-x-2 text-sm">
					<span className="font-medium">Current Status:</span>
					<div
						className={`flex items-center space-x-1 ${
							authStatus.hasApiKey ? "text-green-600" : "text-red-600"
						}`}
					>
						<span
							className={`w-2 h-2 rounded-full ${
								authStatus.hasApiKey ? "bg-green-500" : "bg-red-500"
							}`}
						></span>
						<span>
							{authStatus.hasApiKey ? `${authStatus.apiKey}` : "No API Key"}
						</span>
					</div>
				</div>
			</div>

			<form onSubmit={handleSubmit} className="space-y-4">
				<div>
					<label
						htmlFor="apiKey"
						className="block text-sm font-medium text-gray-700 mb-1"
					>
						API Key
					</label>
					<input
						type="password"
						id="apiKey"
						value={apiKey}
						onChange={(e) => setApiKey(e.target.value)}
						placeholder="Enter your API key (om_...)"
						className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
					/>
					<p className="text-xs text-gray-500 mt-1">
						API keys should start with "om_" prefix
					</p>
				</div>

				{message && (
					<div
						className={`text-sm p-2 rounded ${
							message.includes("success")
								? "bg-green-100 text-green-700"
								: "bg-red-100 text-red-700"
						}`}
					>
						{message}
					</div>
				)}

				<div className="flex space-x-3">
					<button
						type="submit"
						disabled={loading || !apiKey.trim()}
						className="flex-1 bg-sky-600 text-white py-2 px-4 rounded-md hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? "Configuring..." : "Set API Key"}
					</button>

					{authStatus.hasApiKey && (
						<button
							type="button"
							onClick={handleClear}
							className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
						>
							Clear
						</button>
					)}

					{onClose && (
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
						>
							Cancel
						</button>
					)}
				</div>
			</form>

			<div className="mt-4 text-xs text-gray-500">
				<p>
					<strong>Note:</strong> In production, API keys should be configured
					through environment variables.
				</p>
				<p>This interface is for development and testing purposes.</p>
			</div>
		</div>
	);
}
