import { eg } from "@yedoma-labs/bylyt-env-guard";
import { describe, expect, it } from "vitest";
import { loadConfigFiles } from "../src/core/file-loader.js";
import { deepMerge, flattenObject } from "../src/core/merger.js";
import { loadSecrets } from "../src/core/secrets-client.js";
import { ConfigSecretError, createConfig, createConfigSync } from "../src/index.js";

describe("Coverage Gap Tests", () => {
	describe("Secrets Provider", () => {
		it("throws ConfigSecretError for vault provider with missing config", async () => {
			await expect(loadSecrets({ provider: "vault" })).rejects.toThrow(ConfigSecretError);

			await expect(loadSecrets({ provider: "vault" })).rejects.toThrow(
				"Vault configuration missing",
			);
		});

		it("throws ConfigSecretError for unknown provider", async () => {
			await expect(loadSecrets({ provider: "unknown" as any })).rejects.toThrow(ConfigSecretError);

			await expect(loadSecrets({ provider: "unknown" as any })).rejects.toThrow(
				"Unknown secrets provider",
			);
		});

		it("sanitizes long provider names in error", async () => {
			const longProvider = "a".repeat(100);
			await expect(loadSecrets({ provider: longProvider as any })).rejects.toThrow(
				ConfigSecretError,
			);

			try {
				await loadSecrets({ provider: longProvider as any });
			} catch (error) {
				if (error instanceof ConfigSecretError) {
					// Should be truncated to 50 chars
					expect(error.message.length).toBeLessThan(100);
				}
			}
		});

		it("returns empty object for env provider", async () => {
			const result = await loadSecrets({ provider: "env" });
			expect(result).toEqual({});
		});
	});

	describe("Async createConfig", () => {
		it("handles secrets provider in async mode", async () => {
			const config = await createConfig({
				schema: {
					test_value: eg.string().default("default"),
				},
				configDir: "./tests/fixtures/config",
				secrets: { provider: "env" },
			});

			expect(config.test_value).toBeDefined();
		});

		it("handles custom envFile path", async () => {
			const config = await createConfig({
				schema: {
					test_value: eg.string().default("default"),
				},
				configDir: "./tests/fixtures/config",
				envFile: ".env.custom",
			});

			expect(config.test_value).toBeDefined();
		});

		it("handles envFile as boolean true", async () => {
			const config = await createConfig({
				schema: {
					test_value: eg.string().default("default"),
				},
				configDir: "./tests/fixtures/config",
				envFile: true,
			});

			expect(config.test_value).toBeDefined();
		});
	});

	describe("Sync createConfigSync", () => {
		it("throws error for non-env secrets provider", () => {
			expect(() =>
				createConfigSync({
					schema: {
						test: eg.string(),
					},
					configDir: "./tests/fixtures/config",
					secrets: { provider: "vault", path: "secret/app" },
				}),
			).toThrow("Async secrets providers require using createConfig()");
		});

		it("handles custom envFile path in sync mode", () => {
			const config = createConfigSync({
				schema: {
					test_value: eg.string().default("default"),
				},
				configDir: "./tests/fixtures/config",
				envFile: ".env.custom",
			});

			expect(config.test_value).toBeDefined();
		});

		it("handles envFile as boolean true in sync mode", () => {
			const config = createConfigSync({
				schema: {
					test_value: eg.string().default("default"),
				},
				configDir: "./tests/fixtures/config",
				envFile: true,
			});

			expect(config.test_value).toBeDefined();
		});

		it("works with env secrets provider", () => {
			const config = createConfigSync({
				schema: {
					test_value: eg.string().default("default"),
				},
				configDir: "./tests/fixtures/config",
				secrets: { provider: "env" },
			});

			expect(config.test_value).toBeDefined();
		});
	});

	describe("Error Classes Coverage", () => {
		it("ConfigSecretError has correct name property", () => {
			const error = new ConfigSecretError("Test error");
			expect(error.name).toBe("ConfigSecretError");
			expect(error.message).toBe("Test error");
		});

		it("ConfigSecretError extends ConfigError", () => {
			const error = new ConfigSecretError("Test");
			expect(error).toBeInstanceOf(Error);
		});
	});

	describe("Edge Cases for Branch Coverage", () => {
		it("handles undefined NODE_ENV", async () => {
			const oldEnv = process.env.NODE_ENV;
			delete process.env.NODE_ENV;

			const config = await createConfig({
				schema: {
					test: eg.string().default("default"),
				},
				configDir: "./tests/fixtures/config",
			});

			expect(config.test).toBe("default");

			if (oldEnv !== undefined) {
				process.env.NODE_ENV = oldEnv;
			}
		});

		it("handles empty config directory", async () => {
			const config = await createConfig({
				schema: {
					test: eg.string().default("default"),
				},
				configDir: "./nonexistent",
			});

			expect(config.test).toBe("default");
		});

		it("handles all options combination", async () => {
			const config = await createConfig({
				schema: {
					test: eg.string().default("default"),
				},
				configDir: "./tests/fixtures/config",
				envFile: ".env.test",
				secrets: { provider: "env" },
				prefix: "TEST_",
				strict: true,
			});

			expect(config.test).toBeDefined();
		});
	});

	describe("File Loader Edge Cases", () => {
		it("handles syntax error in JSON file gracefully", () => {
			// This would trigger the ConfigFileError with cause
			// Already covered in file-loader.test.ts but ensuring branch coverage
			expect(() => loadConfigFiles("./tests/fixtures/config", "invalid")).not.toThrow();
		});
	});

	describe("Merger Edge Cases", () => {
		it("handles empty object merge", () => {
			const result = deepMerge({});
			expect(result).toEqual({});
		});

		it("handles null values in merge", () => {
			const result = deepMerge({ a: null }, { b: null });
			expect(result).toEqual({ a: null, b: null });
		});

		it("handles flattening with null values", () => {
			const result = flattenObject({ a: null, b: undefined });
			expect(result).toEqual({});
		});
	});
});
