import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "../src/index.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("README Examples", () => {
	const testDir = join(process.cwd(), "tests", "fixtures", "examples");

	beforeEach(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Quick Start Example", () => {
		it("should work as shown in README", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					database: {
						host: "localhost",
						port: 5432,
						pool: {
							min: 2,
							max: 10,
						},
					},
					server: {
						port: 3000,
					},
				}),
			);

			const config = createConfigSync({
				schema: {
					database_host: eg.string().required(),
					database_port: eg.integer().default(5432),
					database_pool_min: eg.integer().default(2),
					database_pool_max: eg.integer().default(10),
					server_port: eg.port().default(3000),
				},
				configDir: testDir,
			});

			expect(config.database_host).toBe("localhost");
			expect(config.server_port).toBe(3000);
		});
	});

	describe("Configuration Cascading Example", () => {
		it("should cascade correctly", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({ server: { port: 3000, host: "localhost" } }),
			);

			writeFileSync(
				join(testDir, "production.json"),
				JSON.stringify({ server: { port: 8080 } }),
			);

			const originalEnv = process.env.NODE_ENV;
			const originalPort = process.env.APP_server_port;

			try {
				process.env.NODE_ENV = "production";
				process.env.APP_server_port = "9000";

				const config = createConfigSync({
					schema: {
						server_port: eg.port(),
						server_host: eg.string().default("localhost"),
					},
					configDir: testDir,
					prefix: "APP_",
				});

				expect(config.server_port).toBe(9000); // from env var
				expect(config.server_host).toBe("localhost"); // from default.json or default value
			} finally {
				process.env.NODE_ENV = originalEnv;
				if (originalPort !== undefined) {
					process.env.APP_server_port = originalPort;
				} else {
					delete process.env.APP_server_port;
				}
			}
		});
	});

	describe("Variable Interpolation Example", () => {
		it("should interpolate environment variables", () => {
			const originalDbUser = process.env.DB_USER;
			const originalDbPassword = process.env.DB_PASSWORD;
			const originalDbHost = process.env.DB_HOST;

			try {
				process.env.DB_USER = "admin";
				process.env.DB_PASSWORD = "secret123";
				process.env.DB_HOST = "db.example.com";

				writeFileSync(
					join(testDir, "default.json"),
					JSON.stringify({
						database: {
							url: "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/myapp",
						},
					}),
				);

				const config = createConfigSync({
					schema: {
						database_url: eg.string(),
					},
					configDir: testDir,
				});

				expect(config.database_url).toBe(
					"postgresql://admin:secret123@db.example.com/myapp",
				);
			} finally {
				if (originalDbUser !== undefined)
					process.env.DB_USER = originalDbUser;
				else delete process.env.DB_USER;
				if (originalDbPassword !== undefined)
					process.env.DB_PASSWORD = originalDbPassword;
				else delete process.env.DB_PASSWORD;
				if (originalDbHost !== undefined) process.env.DB_HOST = originalDbHost;
				else delete process.env.DB_HOST;
			}
		});

		it("should handle escaped interpolation", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					example: "This is a literal \\${NOT_INTERPOLATED}",
				}),
			);

			const config = createConfigSync({
				schema: {
					example: eg.string(),
				},
				configDir: testDir,
			});

			expect(config.example).toBe("This is a literal ${NOT_INTERPOLATED}");
		});
	});

	describe("Basic Web Server Example", () => {
		it("should configure web server correctly", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					port: 3000,
					host: "0.0.0.0",
					database: {
						url: "postgresql://localhost:5432/mydb",
					},
					log: {
						level: "info",
					},
				}),
			);

			const config = createConfigSync({
				schema: {
					port: eg.port().default(3000),
					host: eg.string().default("0.0.0.0"),
					database_url: eg.url().required(),
					log_level: eg
						.enum(["debug", "info", "warn", "error"] as const)
						.default("info"),
				},
				configDir: testDir,
			});

			expect(config.port).toBe(3000);
			expect(config.host).toBe("0.0.0.0");
			expect(config.database_url).toBe("postgresql://localhost:5432/mydb");
			expect(config.log_level).toBe("info");
		});
	});

	describe("Deep Nesting Example", () => {
		it("should handle deeply nested config", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					services: {
						redis: {
							cluster: {
								nodes: ["localhost:6379"],
							},
						},
					},
				}),
			);

			const config = createConfigSync({
				schema: {
					services_redis_cluster_nodes: eg
						.array()
						.separator(",")
						.default(["localhost:6379"]),
				},
				configDir: testDir,
			});

			expect(config.services_redis_cluster_nodes).toEqual(["localhost:6379"]);
		});
	});

	describe("Multi-Environment Example", () => {
		it("should merge multi-environment configs correctly", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					database: {
						pool: { min: 2, max: 10 },
						timeout: 5000,
						ssl: false,
					},
					cache: {
						ttl: 300,
						enabled: true,
					},
					logging: {
						level: "info",
					},
				}),
			);

			writeFileSync(
				join(testDir, "production.json"),
				JSON.stringify({
					database: {
						pool: { min: 10, max: 100 },
						ssl: true,
						timeout: 10000,
					},
					cache: {
						ttl: 3600,
					},
					logging: {
						level: "warn",
					},
				}),
			);

			const originalEnv = process.env.NODE_ENV;
			try {
				process.env.NODE_ENV = "production";

				const config = createConfigSync({
					schema: {
						database_pool_min: eg.integer(),
						database_pool_max: eg.integer(),
						database_timeout: eg.integer(),
						database_ssl: eg.boolean(),
						cache_ttl: eg.integer(),
						cache_enabled: eg.boolean(),
						logging_level: eg.enum([
							"debug",
							"info",
							"warn",
							"error",
						] as const),
					},
					configDir: testDir,
				});

				expect(config.logging_level).toBe("warn");
				expect(config.database_pool_max).toBe(100);
				expect(config.cache_enabled).toBe(true); // from default
			} finally {
				process.env.NODE_ENV = originalEnv;
			}
		});
	});

	describe("Nested Object Deep Merging Example", () => {
		it("should merge nested objects as shown in README", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					services: {
						api: {
							endpoints: {
								users: "/api/v1/users",
								posts: "/api/v1/posts",
							},
							timeout: 5000,
							retry: {
								attempts: 3,
								backoff: 1000,
							},
						},
					},
				}),
			);

			writeFileSync(
				join(testDir, "production.json"),
				JSON.stringify({
					services: {
						api: {
							endpoints: {
								users: "/api/v2/users",
							},
							retry: {
								attempts: 5,
							},
						},
					},
				}),
			);

			const originalEnv = process.env.NODE_ENV;
			try {
				process.env.NODE_ENV = "production";

				const config = createConfigSync({
					schema: {
						services_api_endpoints_users: eg.string(),
						services_api_endpoints_posts: eg.string(),
						services_api_timeout: eg.integer(),
						services_api_retry_attempts: eg.integer(),
						services_api_retry_backoff: eg.integer(),
					},
					configDir: testDir,
				});

				expect(config.services_api_endpoints_users).toBe("/api/v2/users");
				expect(config.services_api_endpoints_posts).toBe("/api/v1/posts");
				expect(config.services_api_retry_attempts).toBe(5);
				expect(config.services_api_retry_backoff).toBe(1000);
			} finally {
				process.env.NODE_ENV = originalEnv;
			}
		});
	});

	describe("Array Handling Example", () => {
		it("should handle arrays as documented", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					allowed_origins: ["http://localhost:3000", "http://localhost:3001"],
					features: ["auth", "search", "upload"],
				}),
			);

			const config = createConfigSync({
				schema: {
					allowed_origins: eg.array().separator(",").default(["*"]),
					features: eg.array().separator(",").default([]),
				},
				configDir: testDir,
			});

			expect(config.allowed_origins).toEqual([
				"http://localhost:3000",
				"http://localhost:3001",
			]);
			expect(config.features).toEqual(["auth", "search", "upload"]);
		});
	});

	describe("TypeScript Strict Mode Example", () => {
		it("should provide type safety", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					server: { port: 3000 },
					database: { url: "postgresql://localhost/db" },
					redis: { enabled: false },
					log: { level: "info" },
				}),
			);

			const configSchema = {
				server_port: eg.port().default(3000),
				database_url: eg.url().required(),
				redis_enabled: eg.boolean().default(false),
				log_level: eg
					.enum(["debug", "info", "warn", "error"] as const)
					.default("info"),
			} as const;

			const config = createConfigSync({
				schema: configSchema,
				configDir: testDir,
			});

			// Type checks
			const port: number = config.server_port;
			const url: string = config.database_url;
			const level: "debug" | "info" | "warn" | "error" = config.log_level;

			expect(port).toBe(3000);
			expect(url).toBe("postgresql://localhost/db");
			expect(level).toBe("info");
		});
	});

	describe("Prefix Example", () => {
		it("should work with prefix", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					database: { host: "localhost", port: 5432 },
				}),
			);

			const originalHost = process.env.MYAPP_database_host;
			const originalPort = process.env.MYAPP_database_port;

			try {
				process.env.MYAPP_database_host = "prod.db.example.com";
				process.env.MYAPP_database_port = "5433";

				const config = createConfigSync({
					schema: {
						database_host: eg.string(),
						database_port: eg.port(),
					},
					prefix: "MYAPP_",
					configDir: testDir,
				});

				expect(config.database_host).toBe("prod.db.example.com");
				expect(config.database_port).toBe(5433);
			} finally {
				if (originalHost !== undefined)
					process.env.MYAPP_database_host = originalHost;
				else delete process.env.MYAPP_database_host;
				if (originalPort !== undefined)
					process.env.MYAPP_database_port = originalPort;
				else delete process.env.MYAPP_database_port;
			}
		});
	});

	describe("Error Handling Examples", () => {
		it("should throw proper errors as documented", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					optional: "${UNDEFINED_VAR}",
				}),
			);

			expect(() => {
				createConfigSync({
					schema: {
						required_field: eg.string().required(),
					},
					configDir: testDir,
				});
			}).toThrow();
		});
	});

	describe("Migration Examples", () => {
		it("dotenv migration should work", () => {
			// Simulating dotenv style
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({ database: { host: "localhost", port: 5432 } }),
			);

			const config = createConfigSync({
				schema: {
					database_host: eg.string().required(),
					database_port: eg.port().default(5432),
				},
				configDir: testDir,
			});

			expect(config.database_host).toBe("localhost");
			expect(config.database_port).toBe(5432);
		});
	});
});
