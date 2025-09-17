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
						API_KEY_SECRET: "test-secret",
						ENVIRONMENT: "test",
						JWT_SECRET: "test-jwt",
					},
				},
				wrangler: { configPath: "./wrangler.json" },
			},
		},
		watch: false,
	},
});
