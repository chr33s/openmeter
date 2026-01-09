import {
	defineWorkersConfig,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";
import { join } from "node:path";

export default defineWorkersConfig(async () => {
	const migrationsPath = join(__dirname, "migrations");
	const migrations = await readD1Migrations(migrationsPath);

	return {
		test: {
			include: ["tests/*.test.ts"],
			name: "worker",
			poolOptions: {
				workers: {
					main: "./index.ts",
					miniflare: {
						bindings: {
							API_KEY_SECRET: "test-secret",
							ENVIRONMENT: "test",
							JWT_SECRET: "test-jwt",
							TEST_MIGRATIONS: migrations,
						},
					},
					wrangler: { configPath: "./wrangler.json" },
				},
			},
			setupFiles: ["./tests/setup.ts"],
			watch: false,
		},
	};
});
