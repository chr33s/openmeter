import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
	test: {
		include: ["tests/*.test.ts"],
		name: "worker",
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
		watch: false,
	},
});
