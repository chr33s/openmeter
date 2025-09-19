/**
 * App initialization utilities
 * Handles configuration setup for different environments
 */

import { initializeConfig } from "./config";
import { apiClient } from "./api";

/**
 * Initialize the application with environment-specific configuration
 * This should be called once when the app starts
 */
export function initializeApp() {
	// In Cloudflare Pages, environment variables might be injected differently
	// Try to detect and configure the environment

	// Development mode (with proxy)
	if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
		console.log("Development mode detected");
		// In development, API calls go through proxy to localhost:8080
		// The API key might not be needed due to proxy setup
	} else {
		console.log("Production mode detected");
		// In production, we need proper API authentication
	}

	// Try to get configuration from various sources
	const config: any = {};

	// 1. Check if configuration was injected by the build process
	if (typeof window !== "undefined" && (window as any).__CLOUDFLARE_CONFIG__) {
		Object.assign(config, (window as any).__CLOUDFLARE_CONFIG__);
	}

	// 2. Check for inline configuration (could be injected by the worker)
	if (typeof window !== "undefined" && (window as any).__APP_CONFIG__) {
		Object.assign(config, (window as any).__APP_CONFIG__);
	}

	// 3. Use default development configuration
	if (!config.API_KEY) {
		config.API_KEY = "om_admin_development_key"; // Default for development
		console.warn(
			"Using default development API key. Configure API_KEY for production.",
		);
	}

	// Initialize the configuration
	initializeConfig(config);

	// Update API client if we have a new API key
	if (config.API_KEY) {
		apiClient.setApiKey(config.API_KEY);
		console.log("API client configured with authentication");
	}

	console.log("App initialization complete", {
		hasApiKey: !!config.API_KEY,
		environment: config.ENVIRONMENT || "unknown",
	});
}

/**
 * Configure the app with specific API key
 * Useful for setting up authentication after user login or key retrieval
 */
export function configureApiKey(apiKey: string) {
	initializeConfig({ API_KEY: apiKey });
	apiClient.setApiKey(apiKey);
	console.log("API key updated");
}

/**
 * Get authentication status
 */
export function getAuthStatus() {
	return {
		hasApiKey: !!apiClient.getApiKey(),
		apiKey: apiClient.getApiKey()?.substring(0, 8) + "...", // Only show first 8 chars for security
	};
}
