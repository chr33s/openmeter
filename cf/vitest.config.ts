import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		globals: true,
		poolOptions: {
			workers: {
				main: "./api/index.ts",
				miniflare: {
					bindings: {
						ENVIRONMENT: "test",
					},
				},
				wrangler: { configPath: "./wrangler.json" },
			},
		},
	},
});
