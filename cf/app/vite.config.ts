import { cloudflare } from "@cloudflare/vite-plugin";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwind(),
		react(),
		cloudflare({
			auxiliaryWorkers: [{ configPath: "../api/wrangler.json" }],
		}),
	],
	define: {
		// Inject API key at build time from environment
		__API_KEY__: JSON.stringify(
			process.env.API_KEY || "om_admin_development_key",
		),
		__ENVIRONMENT__: JSON.stringify(process.env.ENVIRONMENT || "development"),
	},
	server: {
		port: 8081,
		proxy: {
			"/api": {
				target: "http://localhost:8080",
				changeOrigin: true,
			},
		},
	},
});
