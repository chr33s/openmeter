/**
 * Environment configuration for Cloudflare Pages
 * This module handles environment variables and configuration
 */

export interface AppConfig {
	API_KEY?: string;
	API_BASE_URL?: string;
	ENVIRONMENT?: string;
}

/**
 * Get configuration from various sources
 * In Cloudflare Pages, env vars are available through different means
 */
function getConfig(): AppConfig {
	// Try different ways to access environment variables
	const config: AppConfig = {};

	// 1. Try process.env (Node.js environments)
	if (typeof process !== "undefined" && process.env) {
		config.API_KEY = process.env.API_KEY;
		config.API_BASE_URL = process.env.API_BASE_URL;
		config.ENVIRONMENT = process.env.ENVIRONMENT;
	}

	// 2. Try globalThis (Cloudflare Workers/Pages)
	if (typeof globalThis !== "undefined") {
		const global = globalThis as any;
		config.API_KEY = config.API_KEY || global.API_KEY;
		config.API_BASE_URL = config.API_BASE_URL || global.API_BASE_URL;
		config.ENVIRONMENT = config.ENVIRONMENT || global.ENVIRONMENT;
	}

	// 3. Try window object (browser environment with injected variables)
	if (typeof window !== "undefined") {
		const win = window as any;
		config.API_KEY = config.API_KEY || win.__APP_CONFIG__?.API_KEY;
		config.API_BASE_URL =
			config.API_BASE_URL || win.__APP_CONFIG__?.API_BASE_URL;
		config.ENVIRONMENT = config.ENVIRONMENT || win.__APP_CONFIG__?.ENVIRONMENT;
	}

	return config;
}

export const appConfig = getConfig();

/**
 * Initialize configuration with provided values
 * Useful for setting up the app with runtime configuration
 */
export function initializeConfig(config: Partial<AppConfig>): void {
	Object.assign(appConfig, config);
}

/**
 * Get a specific config value with fallback
 */
export function getConfigValue(
	key: keyof AppConfig,
	fallback?: string,
): string | undefined {
	return appConfig[key] || fallback;
}
