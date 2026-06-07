import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "../src/index.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

describe("Advanced Features", () => {
	const testDir = join(process.cwd(), "tests", "fixtures", "advanced");

	beforeEach(() => {
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Deep Object Merging (5+ levels)", () => {
		it("should merge deeply nested objects correctly", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					level1: {
						level2: {
							level3: {
								level4: {
									level5: {
										value: "base",
										baseOnly: "base-only",
									},
								},
							},
						},
					},
				}),
			);

			writeFileSync(
				join(testDir, "test.json"),
				JSON.stringify({
					level1: {
						level2: {
							level3: {
								level4: {
									level5: {
										value: "override",
									},
								},
							},
						},
					},
				}),
			);

			const config = createConfigSync({
				schema: {
					level1_level2_level3_level4_level5_value: eg.string(),
					level1_level2_level3_level4_level5_baseOnly: eg.string(),
				},
				configDir: testDir,
			});

			expect(config.level1_level2_level3_level4_level5_value).toBe("override");
			expect(config.level1_level2_level3_level4_level5_baseOnly).toBe(
				"base-only",
			);
		});

		it("should handle mixed depth merging", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					shallow: "base",
					deep: {
						a: {
							b: {
								c: {
									d: {
										e: "base-deep",
									},
								},
							},
						},
					},
				}),
			);

			writeFileSync(
				join(testDir, "test.json"),
				JSON.stringify({
					shallow: "override",
					deep: {
						a: {
							b: {
								c: {
									d: {
										f: "new-value",
									},
								},
							},
						},
					},
				}),
			);

			const config = createConfigSync({
				schema: {
					shallow: eg.string(),
					deep_a_b_c_d_e: eg.string(),
					deep_a_b_c_d_f: eg.string(),
				},
				configDir: testDir,
			});

			expect(config.shallow).toBe("override");
			expect(config.deep_a_b_c_d_e).toBe("base-deep");
			expect(config.deep_a_b_c_d_f).toBe("new-value");
		});
	});

	describe("Array Merging Behavior", () => {
		it("should replace arrays completely (not merge)", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					items: ["a", "b", "c"],
				}),
			);

			writeFileSync(
				join(testDir, "test.json"),
				JSON.stringify({
					items: ["x", "y"],
				}),
			);

			const config = createConfigSync({
				schema: {
					items: eg.array().separator(","),
				},
				configDir: testDir,
			});

			expect(config.items).toEqual(["x", "y"]);
		});

		it("should handle nested arrays", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					config: {
						servers: {
							nodes: ["node1", "node2"],
						},
					},
				}),
			);

			writeFileSync(
				join(testDir, "test.json"),
				JSON.stringify({
					config: {
						servers: {
							nodes: ["node3"],
						},
					},
				}),
			);

			const config = createConfigSync({
				schema: {
					config_servers_nodes: eg.array().separator(","),
				},
				configDir: testDir,
			});

			expect(config.config_servers_nodes).toEqual(["node3"]);
		});

		it("should handle empty arrays", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					allowed: ["all"],
				}),
			);

			writeFileSync(
				join(testDir, "test.json"),
				JSON.stringify({
					allowed: [],
				}),
			);

			const config = createConfigSync({
				schema: {
					allowed: eg.array().separator(",").default(["default"]),
				},
				configDir: testDir,
			});

			expect(config.allowed).toEqual([]);
		});
	});

	describe("Multiple Config File Formats", () => {
		it("should load different environments", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({ env: "default", port: 3000 }),
			);

			writeFileSync(
				join(testDir, "development.json"),
				JSON.stringify({ env: "development", port: 3001 }),
			);

			writeFileSync(
				join(testDir, "production.json"),
				JSON.stringify({ env: "production", port: 8080 }),
			);

			const originalEnv = process.env.NODE_ENV;
			try {
				// Test development
				process.env.NODE_ENV = "development";
				const devConfig = createConfigSync({
					schema: {
						env: eg.string(),
						port: eg.port(),
					},
					configDir: testDir,
				});
				expect(devConfig.env).toBe("development");
				expect(devConfig.port).toBe(3001);

				// Test production
				process.env.NODE_ENV = "production";
				const prodConfig = createConfigSync({
					schema: {
						env: eg.string(),
						port: eg.port(),
					},
					configDir: testDir,
				});
				expect(prodConfig.env).toBe("production");
				expect(prodConfig.port).toBe(8080);
			} finally {
				process.env.NODE_ENV = originalEnv;
			}
		});
	});

	describe("Config Priority Edge Cases", () => {
		it("should prioritize env vars over all config files", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({ value: "default" }),
			);

			writeFileSync(
				join(testDir, "test.json"),
				JSON.stringify({ value: "test" }),
			);

			const originalValue = process.env.VALUE;
			const originalPrefix = process.env.APP_value;
			try {
				process.env.APP_value = "env";
				const config = createConfigSync({
					schema: {
						value: eg.string(),
					},
					configDir: testDir,
					prefix: "APP_",
				});

				expect(config.value).toBe("env");
			} finally {
				if (originalValue !== undefined) {
					process.env.VALUE = originalValue;
				} else {
					delete process.env.VALUE;
				}
				if (originalPrefix !== undefined) {
					process.env.APP_value = originalPrefix;
				} else {
					delete process.env.APP_value;
				}
			}
		});

		it("should handle missing environment config gracefully", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({ value: "base" }),
			);

			const originalEnv = process.env.NODE_ENV;
			try {
				process.env.NODE_ENV = "staging"; // No staging.json exists

				const config = createConfigSync({
					schema: {
						value: eg.string(),
					},
					configDir: testDir,
				});

				expect(config.value).toBe("base");
			} finally {
				process.env.NODE_ENV = originalEnv;
			}
		});

		it("should apply schema defaults when no config provided", () => {
			writeFileSync(join(testDir, "default.json"), JSON.stringify({}));

			const config = createConfigSync({
				schema: {
					timeout: eg.integer().default(5000),
					enabled: eg.boolean().default(true),
				},
				configDir: testDir,
			});

			expect(config.timeout).toBe(5000);
			expect(config.enabled).toBe(true);
		});
	});

	describe("Error Recovery Scenarios", () => {
		it("should recover from partial config with defaults", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					server: {
						port: 3000,
					},
				}),
			);

			const config = createConfigSync({
				schema: {
					server_port: eg.port(),
					server_host: eg.string().default("localhost"),
					server_timeout: eg.integer().default(30000),
				},
				configDir: testDir,
			});

			expect(config.server_port).toBe(3000);
			expect(config.server_host).toBe("localhost");
			expect(config.server_timeout).toBe(30000);
		});

		it("should handle interpolation errors gracefully in optional fields", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					required: "value",
					optional: "${MISSING_VAR}",
				}),
			);

			expect(() => {
				createConfigSync({
					schema: {
						required: eg.string(),
						optional: eg.string().optional(),
					},
					configDir: testDir,
				});
			}).toThrow("Undefined environment variable");
		});
	});

	describe("Large Config Files (Performance)", () => {
		it("should handle large nested config efficiently", () => {
			const largeConfig: Record<string, unknown> = {};
			const schema: Record<string, ReturnType<typeof eg.string>> = {};

			// Generate 100 nested properties
			for (let i = 0; i < 100; i++) {
				largeConfig[`section${i}`] = {
					subsection: {
						value: `value${i}`,
						number: i,
					},
				};
				schema[`section${i}_subsection_value`] = eg.string();
				schema[`section${i}_subsection_number`] = eg.integer();
			}

			writeFileSync(join(testDir, "default.json"), JSON.stringify(largeConfig));

			const start = performance.now();
			const config = createConfigSync({
				schema,
				configDir: testDir,
			});
			const duration = performance.now() - start;

			// Should load in under 100ms
			expect(duration).toBeLessThan(100);
			expect(config.section0_subsection_value).toBe("value0");
			expect(config.section99_subsection_number).toBe(99);
		});
	});

	describe("Config with Special Characters", () => {
		it("should handle special characters in values", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					special: {
						quotes: 'He said "hello"',
						newline: "line1\\nline2",
						unicode: "Hello 🌍",
						url: "https://example.com/path?query=value&other=123",
					},
				}),
			);

			const config = createConfigSync({
				schema: {
					special_quotes: eg.string(),
					special_newline: eg.string(),
					special_unicode: eg.string(),
					special_url: eg.url(),
				},
				configDir: testDir,
			});

			expect(config.special_quotes).toBe('He said "hello"');
			expect(config.special_newline).toBe("line1\\nline2");
			expect(config.special_unicode).toBe("Hello 🌍");
			expect(config.special_url).toBe(
				"https://example.com/path?query=value&other=123",
			);
		});

		it("should handle escaped interpolation", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					literal: "This is \\${NOT_INTERPOLATED}",
					interpolated: "${HOME}",
				}),
			);

			const config = createConfigSync({
				schema: {
					literal: eg.string(),
					interpolated: eg.string(),
				},
				configDir: testDir,
			});

			expect(config.literal).toBe("This is ${NOT_INTERPOLATED}");
			expect(config.interpolated).toBe(process.env.HOME);
		});

		it("should handle numeric strings correctly", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					port: "3000",
					timeout: "5000",
					flag: "true",
					precision: "3.14159",
				}),
			);

			const config = createConfigSync({
				schema: {
					port: eg.port(),
					timeout: eg.integer(),
					flag: eg.boolean(),
					precision: eg.number(),
				},
				configDir: testDir,
			});

			expect(config.port).toBe(3000);
			expect(config.timeout).toBe(5000);
			expect(config.flag).toBe(true);
			expect(config.precision).toBe(3.14159);
		});
	});

	describe("Concurrent Config Loading", () => {
		it("should handle multiple config loads without interference", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({ value: "shared" }),
			);

			const configs = Array.from({ length: 10 }, () =>
				createConfigSync({
					schema: {
						value: eg.string(),
					},
					configDir: testDir,
				}),
			);

			configs.forEach((config) => {
				expect(config.value).toBe("shared");
			});
		});
	});

	describe("Type Coercion Edge Cases", () => {
		it("should coerce boolean strings correctly", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					boolTrue: "true",
					boolFalse: "false",
					boolOne: "1",
					boolZero: "0",
				}),
			);

			const config = createConfigSync({
				schema: {
					boolTrue: eg.boolean(),
					boolFalse: eg.boolean(),
					boolOne: eg.boolean(),
					boolZero: eg.boolean(),
				},
				configDir: testDir,
			});

			expect(config.boolTrue).toBe(true);
			expect(config.boolFalse).toBe(false);
			expect(config.boolOne).toBe(true);
			expect(config.boolZero).toBe(false);
		});

		it("should handle JSON arrays and objects", () => {
			writeFileSync(
				join(testDir, "default.json"),
				JSON.stringify({
					simple: ["a", "b", "c"],
					complex: JSON.stringify([
						{ id: 1, name: "first" },
						{ id: 2, name: "second" },
					]),
				}),
			);

			const config = createConfigSync({
				schema: {
					simple: eg.array().separator(","),
					complex: eg.json(),
				},
				configDir: testDir,
			});

			expect(config.simple).toEqual(["a", "b", "c"]);
			expect(config.complex).toEqual([
				{ id: 1, name: "first" },
				{ id: 2, name: "second" },
			]);
		});
	});
});
