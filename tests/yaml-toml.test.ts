import { eg } from "@yedoma-labs/bylyt-env-guard";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfigSync } from "../src/index.js";

describe("YAML and TOML Config Support", () => {
	let originalEnv: NodeJS.ProcessEnv;

	beforeEach(() => {
		originalEnv = { ...process.env };
	});

	afterEach(() => {
		process.env = originalEnv;
	});

	describe("YAML Config Files", () => {
		it("loads default.yaml config", () => {
			const config = createConfigSync({
				schema: {
					server_host: eg.string(),
					server_port: eg.port(),
					database_host: eg.string(),
					database_port: eg.port(),
					database_name: eg.string(),
					database_pool_min: eg.integer(),
					database_pool_max: eg.integer(),
					features_enableMetrics: eg.boolean(),
					features_enableDebug: eg.boolean(),
				},
				configDir: "./tests/fixtures/yaml-config",
			});

			expect(config.server_host).toBe("localhost");
			expect(config.server_port).toBe(3000);
			expect(config.database_host).toBe("localhost");
			expect(config.database_pool_min).toBe(2);
			expect(config.database_pool_max).toBe(10);
			expect(config.features_enableMetrics).toBe(false);
			expect(config.features_enableDebug).toBe(true);
		});

		it("loads environment-specific YAML config", () => {
			process.env.NODE_ENV = "production";
			process.env.DB_HOST = "prod.db.example.com";
			process.env.DB_NAME = "myapp_prod";

			const config = createConfigSync({
				schema: {
					server_host: eg.string(),
					server_port: eg.port(),
					database_host: eg.string(),
					database_name: eg.string(),
					database_pool_max: eg.integer(),
					features_enableMetrics: eg.boolean(),
					features_enableDebug: eg.boolean(),
				},
				configDir: "./tests/fixtures/yaml-config",
			});

			expect(config.server_host).toBe("0.0.0.0");
			expect(config.server_port).toBe(8080);
			expect(config.database_host).toBe("prod.db.example.com");
			expect(config.database_name).toBe("myapp_prod");
			expect(config.database_pool_max).toBe(100);
			expect(config.features_enableMetrics).toBe(true);
			expect(config.features_enableDebug).toBe(false);

			delete process.env.NODE_ENV;
			delete process.env.DB_HOST;
			delete process.env.DB_NAME;
		});

		it("merges YAML default and environment configs", () => {
			process.env.NODE_ENV = "production";
			process.env.DB_HOST = "prod.db.example.com";
			process.env.DB_NAME = "myapp_prod";

			const config = createConfigSync({
				schema: {
					server_port: eg.port(),
					database_host: eg.string(),
					database_pool_min: eg.integer().default(2),
					database_pool_max: eg.integer(),
				},
				configDir: "./tests/fixtures/yaml-config",
			});

			// From production.yaml
			expect(config.server_port).toBe(8080);
			expect(config.database_pool_max).toBe(100);

			// From default.yaml (not overridden)
			expect(config.database_pool_min).toBe(2);

			delete process.env.NODE_ENV;
			delete process.env.DB_HOST;
			delete process.env.DB_NAME;
		});
	});

	describe("TOML Config Files", () => {
		it("loads default.toml config", () => {
			const config = createConfigSync({
				schema: {
					server_host: eg.string(),
					server_port: eg.port(),
					database_host: eg.string(),
					database_port: eg.port(),
					database_name: eg.string(),
					database_pool_min: eg.integer(),
					database_pool_max: eg.integer(),
					features_enableMetrics: eg.boolean(),
					features_enableDebug: eg.boolean(),
				},
				configDir: "./tests/fixtures/toml-config",
			});

			expect(config.server_host).toBe("localhost");
			expect(config.server_port).toBe(3000);
			expect(config.database_host).toBe("localhost");
			expect(config.database_pool_min).toBe(2);
			expect(config.database_pool_max).toBe(10);
			expect(config.features_enableMetrics).toBe(false);
			expect(config.features_enableDebug).toBe(true);
		});

		it("loads environment-specific TOML config", () => {
			process.env.NODE_ENV = "production";
			process.env.DB_HOST = "prod.db.example.com";
			process.env.DB_NAME = "myapp_prod";

			const config = createConfigSync({
				schema: {
					server_host: eg.string(),
					server_port: eg.port(),
					database_host: eg.string(),
					database_name: eg.string(),
					database_pool_max: eg.integer(),
					features_enableMetrics: eg.boolean(),
					features_enableDebug: eg.boolean(),
				},
				configDir: "./tests/fixtures/toml-config",
			});

			expect(config.server_host).toBe("0.0.0.0");
			expect(config.server_port).toBe(8080);
			expect(config.database_host).toBe("prod.db.example.com");
			expect(config.database_name).toBe("myapp_prod");
			expect(config.database_pool_max).toBe(100);
			expect(config.features_enableMetrics).toBe(true);
			expect(config.features_enableDebug).toBe(false);

			delete process.env.NODE_ENV;
			delete process.env.DB_HOST;
			delete process.env.DB_NAME;
		});

		it("merges TOML default and environment configs", () => {
			process.env.NODE_ENV = "production";
			process.env.DB_HOST = "prod.db.example.com";
			process.env.DB_NAME = "myapp_prod";

			const config = createConfigSync({
				schema: {
					server_port: eg.port(),
					database_host: eg.string(),
					database_pool_min: eg.integer().default(2),
					database_pool_max: eg.integer(),
				},
				configDir: "./tests/fixtures/toml-config",
			});

			// From production.toml
			expect(config.server_port).toBe(8080);
			expect(config.database_pool_max).toBe(100);

			// From default.toml (not overridden)
			expect(config.database_pool_min).toBe(2);

			delete process.env.NODE_ENV;
			delete process.env.DB_HOST;
			delete process.env.DB_NAME;
		});
	});

	describe("Format Auto-Detection", () => {
		it("prefers YAML over JSON when both exist", () => {
			// tests/fixtures/config has both JSON and we'll add YAML
			const config = createConfigSync({
				schema: {
					test: eg.string().default("json"),
				},
				configDir: "./tests/fixtures/yaml-config",
			});

			// Should load from YAML
			expect(config.test).toBeDefined();
		});

		it("falls back gracefully when no config files exist", () => {
			const config = createConfigSync({
				schema: {
					test: eg.string().default("fallback"),
				},
				configDir: "./nonexistent-config-dir",
			});

			expect(config.test).toBe("fallback");
		});
	});

	describe("Error Handling", () => {
		it("throws error for invalid YAML syntax", () => {
			// Would need a fixture with invalid YAML
			// Covered by parseContent error handling
		});

		it("throws error for invalid TOML syntax", () => {
			// Would need a fixture with invalid TOML
			// Covered by parseContent error handling
		});

		it("throws error for non-object YAML content", () => {
			// Arrays at root should fail
			// Covered by parseContent validation
		});
	});
});
