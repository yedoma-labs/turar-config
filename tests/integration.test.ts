import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfig, createConfigSync } from "../src/index.js";

describe("Integration Tests", () => {
	const originalEnv = process.env.NODE_ENV;

	beforeEach(() => {
		process.env.NODE_ENV = "test";
	});

	afterEach(() => {
		process.env.NODE_ENV = originalEnv;
		delete process.env.DB_HOST;
		delete process.env.API_KEY;
		delete process.env.SHOULD_INTERPOLATE;
	});

	it("loads and validates full config", () => {
		const config = createConfigSync({
			schema: {
				database_host: eg.string().default("localhost"),
				database_port: eg.integer().default(5432),
				database_name: eg.string().default("app"),
				database_pool_min: eg.integer().default(2),
				database_pool_max: eg.integer().default(10),
				server_port: eg.integer().default(3000),
				server_host: eg.string().default("0.0.0.0"),
				logging_level: eg.string().default("info"),
				logging_format: eg.string().default("json"),
				features_enableNewUI: eg.boolean().default(false),
			},
			configDir: "tests/fixtures/config",
		});

		expect(config.database_host).toBe("test-db");
		expect(config.database_port).toBe(5432);
		expect(config.database_name).toBe("test_db");
		expect(config.server_port).toBe(3001);
		expect(config.logging_level).toBe("debug");
	});

	it("interpolates variables from process.env", () => {
		process.env.NODE_ENV = "production";
		process.env.DB_HOST = "prod.example.com";
		process.env.API_KEY = "secret-key-123";

		const config = createConfigSync({
			schema: {
				database_host: eg.string(),
				secrets_apiKey: eg.string().sensitive(),
			},
			configDir: "tests/fixtures/config",
		});

		expect(config.database_host).toBe("prod.example.com");
		expect(config.secrets_apiKey).toBe("secret-key-123");
	});

	it("handles escaped interpolation", () => {
		process.env.NODE_ENV = undefined;
		process.env.SHOULD_INTERPOLATE = "interpolated-value";

		const tmpDir = join(tmpdir(), `turar-escape-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });

		writeFileSync(
			join(tmpDir, "default.json"),
			JSON.stringify({
				example: "This is a literal \\${NOT_INTERPOLATED}",
				interpolated: "${SHOULD_INTERPOLATE}",
			}),
		);

		try {
			const config = createConfigSync({
				schema: {
					example: eg.string(),
					interpolated: eg.string(),
				},
				configDir: tmpDir,
			});

			expect(config.example).toBe("This is a literal ${NOT_INTERPOLATED}");
			expect(config.interpolated).toBe("interpolated-value");
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("works with .env files", () => {
		const tmpDir = join(tmpdir(), `turar-envfile-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		writeFileSync(join(tmpDir, "default.json"), JSON.stringify({}));
		writeFileSync(
			join(tmpDir, ".env"),
			"TEST_api_key=test-secret-123\nTEST_database_url=postgresql://test:test@localhost/testdb\nTEST_port=9999",
		);

		process.env.NODE_ENV = undefined;

		try {
			const config = createConfigSync({
				schema: {
					api_key: eg.string(),
					database_url: eg.url(),
					port: eg.port(),
				},
				configDir: tmpDir,
				envFile: join(tmpDir, ".env"),
				prefix: "TEST_",
			});

			expect(config.api_key).toBe("test-secret-123");
			expect(config.database_url).toBe("postgresql://test:test@localhost/testdb");
			expect(config.port).toBe(9999);
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
		}
	});

	it("async createConfig works", async () => {
		const config = await createConfig({
			schema: {
				database_host: eg.string().default("localhost"),
				server_port: eg.integer().default(3000),
			},
			configDir: "tests/fixtures/config",
			secrets: { provider: "env" },
		});

		expect(config.database_host).toBe("test-db");
		expect(config.server_port).toBe(3001);
	});

	it("validates using bylyt schema validators", () => {
		process.env.NODE_ENV = "production";
		process.env.DB_HOST = "invalid-url";
		process.env.API_KEY = "";

		expect(() =>
			createConfigSync({
				schema: {
					database_host: eg.url(),
					secrets_apiKey: eg.string().minLength(8),
				},
				configDir: "tests/fixtures/config",
			}),
		).toThrow();
	});

	it("supports strict mode", () => {
		process.env.TURAR_TEST_UNEXPECTED = "value";

		expect(() =>
			createConfigSync({
				schema: {
					database_host: eg.string(),
				},
				configDir: "tests/fixtures/config",
				strict: true,
				prefix: "TURAR_TEST_",
			}),
		).toThrow();

		delete process.env.TURAR_TEST_UNEXPECTED;
	});

	it("supports prefix for env vars", () => {
		const tmpDir = join(tmpdir(), `turar-prefix-${Date.now()}`);
		mkdirSync(tmpDir, { recursive: true });
		writeFileSync(join(tmpDir, "default.json"), JSON.stringify({}));

		process.env.NODE_ENV = undefined;
		process.env.APP_database_host = "custom-host";

		try {
			const config = createConfigSync({
				schema: {
					database_host: eg.string().default("localhost"),
				},
				configDir: tmpDir,
				prefix: "APP_",
			});

			expect(config.database_host).toBe("custom-host");
		} finally {
			rmSync(tmpDir, { recursive: true, force: true });
			delete process.env.APP_database_host;
		}
	});
});
