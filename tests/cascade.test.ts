import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createConfigSync } from "../src/index.js";

describe("Configuration Cascading", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `turar-cascade-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
		delete process.env.NODE_ENV;
		delete process.env.TEST_PORT;
		delete process.env.TEST_DEBUG;
	});

	it("merges base and environment config", () => {
		writeFileSync(
			join(testDir, "default.json"),
			JSON.stringify({
				server: { host: "localhost", port: 3000 },
				debug: false,
			}),
		);

		writeFileSync(
			join(testDir, "test.json"),
			JSON.stringify({
				server: { port: 3001 },
				debug: true,
			}),
		);

		process.env.NODE_ENV = "test";

		const config = createConfigSync({
			schema: {
				server_host: eg.string().default("0.0.0.0"),
				server_port: eg.integer().default(80),
				debug: eg.boolean().default(false),
			},
			configDir: testDir,
		});

		expect(config.server_host).toBe("localhost");
		expect(config.server_port).toBe(3001);
		expect(config.debug).toBe(true);
	});

	it("env vars override config files", () => {
		writeFileSync(
			join(testDir, "default.json"),
			JSON.stringify({
				port: 3000,
			}),
		);

		process.env.NODE_ENV = undefined;
		process.env.port = "9999";

		try {
			const config = createConfigSync({
				schema: {
					port: eg.integer().default(80),
				},
				configDir: testDir,
			});

			expect(config.port).toBe(9999);
		} finally {
			delete process.env.port;
		}
	});

	it("schema defaults apply when no other source provides value", () => {
		writeFileSync(join(testDir, "default.json"), JSON.stringify({}));

		const config = createConfigSync({
			schema: {
				port: eg.integer().default(3000),
				debug: eg.boolean().default(false),
			},
			configDir: testDir,
		});

		expect(config.port).toBe(3000);
		expect(config.debug).toBe(false);
	});

	it("follows priority: env > env file > base > defaults", () => {
		writeFileSync(
			join(testDir, "default.json"),
			JSON.stringify({
				port: 3000,
			}),
		);

		writeFileSync(
			join(testDir, "production.json"),
			JSON.stringify({
				port: 8080,
			}),
		);

		writeFileSync(join(testDir, ".env"), "port=5000");

		process.env.NODE_ENV = "production";
		process.env.port = "9999";

		try {
			const config = createConfigSync({
				schema: {
					port: eg.integer().default(80),
				},
				configDir: testDir,
				envFile: join(testDir, ".env"),
			});

			expect(config.port).toBe(9999);
		} finally {
			delete process.env.port;
		}
	});

	it("merges deeply nested configs correctly", () => {
		writeFileSync(
			join(testDir, "default.json"),
			JSON.stringify({
				database: {
					pool: {
						min: 2,
						max: 10,
						timeout: 1000,
					},
				},
			}),
		);

		writeFileSync(
			join(testDir, "production.json"),
			JSON.stringify({
				database: {
					pool: {
						max: 100,
					},
				},
			}),
		);

		process.env.NODE_ENV = "production";

		const config = createConfigSync({
			schema: {
				database_pool_min: eg.integer().default(1),
				database_pool_max: eg.integer().default(5),
				database_pool_timeout: eg.integer().default(500),
			},
			configDir: testDir,
		});

		expect(config.database_pool_min).toBe(2);
		expect(config.database_pool_max).toBe(100);
		expect(config.database_pool_timeout).toBe(1000);
	});
});
