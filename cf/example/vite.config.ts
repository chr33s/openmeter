import { cloudflare } from "@cloudflare/vite-plugin";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [
		tailwind(),
		react(),
		cloudflare({
			auxiliaryWorkers: [{ configPath: "../wrangler.json" }],
		}),
	],
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
