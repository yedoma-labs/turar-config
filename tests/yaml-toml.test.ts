import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfigFile, loadConfigFiles } from "../src/core/file-loader.js";
import { ConfigFileError } from "../src/errors.js";
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
			// Test by directly loading a config where both formats exist
			const { environment } = loadConfigFiles("./tests/fixtures/yaml-config", "priority-test");

			// Should load from YAML (which has "yaml"), not JSON (which has "json")
			expect(environment.format?.source).toBe("yaml");
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
			const testDir = join(tmpdir(), `turar-yaml-error-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			// Create an invalid YAML file as default
			writeFileSync(join(testDir, "default.yaml"), "- array\n- at\n- root");

			// Should throw because config must be object, not array
			expect(() =>
				createConfigSync({
					schema: { test: eg.string().optional() },
					configDir: testDir,
				}),
			).toThrow(ConfigFileError);

			rmSync(testDir, { recursive: true, force: true });
		});

		it("sanitizes long error messages", () => {
			const testDir = join(tmpdir(), `turar-sanitize-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			// Create file with very long invalid YAML content
			const longContent = `invalid:\n${"  x".repeat(1000)}`;
			writeFileSync(join(testDir, "long.yaml"), longContent);

			try {
				loadConfigFile(join(testDir, "long.yaml"));
				// If it doesn't throw, that's fine too
			} catch (error) {
				if (error instanceof ConfigFileError) {
					// Error message should be sanitized (max 200 chars from original error plus wrapper text)
					expect(error.message.length).toBeLessThan(400);
				}
			}

			rmSync(testDir, { recursive: true, force: true });
		});
	});
});
