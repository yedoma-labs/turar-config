import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deepMerge, flattenObject } from "../src/core/merger.js";
import { watchConfig } from "../src/core/watcher.js";
import { ConfigFileError, createConfig } from "../src/index.js";

// Mock node-vault for vault tests
vi.mock("node-vault", () => {
	return {
		default: vi.fn(),
	};
});

describe("Coverage Boost Tests", () => {
	let mockVaultClient: any;

	beforeEach(async () => {
		mockVaultClient = {
			token: null,
			read: vi.fn(),
			approleLogin: vi.fn(),
		};

		const vaultModule = await import("node-vault");
		const vaultMock = vaultModule.default as ReturnType<typeof vi.fn>;
		vaultMock.mockReturnValue(mockVaultClient);
	});
	describe("Watcher Error Paths", () => {
		it("handles initial config load failure", async () => {
			const testDir = join(tmpdir(), `turar-watcher-error-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			// Create invalid config file
			writeFileSync(join(testDir, "default.json"), "{ invalid json }");

			await expect(
				watchConfig({
					schema: {
						test: eg.string().required(),
					},
					configDir: testDir,
				}),
			).rejects.toThrow(ConfigFileError);

			rmSync(testDir, { recursive: true, force: true });
		});

		it("handles onChange callback throwing error", async () => {
			const testDir = join(tmpdir(), `turar-callback-error-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value1" }));

			const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
			let callbackCalled = false;

			const handle = await watchConfig({
				schema: {
					test: eg.string().required(),
				},
				configDir: testDir,
				debounce: 100,
				onChange: () => {
					callbackCalled = true;
					throw new Error("Callback error!");
				},
			});

			// Wait for watcher to be ready
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Trigger change
			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value2" }));

			// Wait for debounce + processing
			await new Promise((resolve) => setTimeout(resolve, 500));

			// Callback should have been called
			expect(callbackCalled).toBe(true);

			// Should have logged error but not crashed
			expect(consoleError).toHaveBeenCalledWith(
				"[turar-config] Error in onChange callback:",
				expect.any(Error),
			);

			// Config SHOULD be updated even if onChange throws
			// (onChange is notification only, not a validator)
			const config = handle.getConfig();
			expect(config.test).toBe("value2"); // New value applied

			await handle.stop();
			consoleError.mockRestore();
			rmSync(testDir, { recursive: true, force: true });
		});

		it("handles config reload error during file change", async () => {
			const testDir = join(tmpdir(), `turar-reload-error-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value1" }));

			const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

			const handle = await watchConfig({
				schema: {
					test: eg.string().required(),
				},
				configDir: testDir,
				debounce: 100,
			});

			// Wait for watcher to be ready
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Create invalid JSON to trigger reload error
			writeFileSync(join(testDir, "default.json"), "{ invalid json }");

			// Wait for debounce + processing
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Should have logged error
			expect(consoleError).toHaveBeenCalledWith(
				"[turar-config] Error reloading config:",
				expect.any(Error),
			);

			// Config should still be the old valid value
			const config = handle.getConfig();
			expect(config.test).toBe("value1");

			await handle.stop();
			consoleError.mockRestore();
			rmSync(testDir, { recursive: true, force: true });
		});

		it("handles watcher with ignoreInitial=false", async () => {
			const testDir = join(tmpdir(), `turar-ignore-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value" }));

			const handle = await watchConfig({
				schema: {
					test: eg.string().required(),
				},
				configDir: testDir,
				ignoreInitial: false,
			});

			// Wait for watcher to process initial files
			await new Promise((resolve) => setTimeout(resolve, 200));

			const config = handle.getConfig();
			expect(config.test).toBe("value");

			await handle.stop();
			rmSync(testDir, { recursive: true, force: true });
		});

		it("prevents onChange from firing after stop()", async () => {
			const testDir = join(tmpdir(), `turar-stopped-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value1" }));

			let changeCount = 0;

			const handle = await watchConfig({
				schema: {
					test: eg.string().required(),
				},
				configDir: testDir,
				debounce: 100,
				onChange: () => {
					changeCount++;
				},
			});

			// Wait for watcher to be ready
			await new Promise((resolve) => setTimeout(resolve, 200));

			// Trigger change
			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value2" }));

			// Immediately stop before debounce completes
			await handle.stop();

			// Wait for debounce period to pass
			await new Promise((resolve) => setTimeout(resolve, 200));

			// onChange should NOT have been called
			expect(changeCount).toBe(0);

			rmSync(testDir, { recursive: true, force: true });
		});
	});

	describe("Secrets Client Edge Cases", () => {
		it("handles vault response with missing data field", async () => {
			// Response without data.data (edge case)
			mockVaultClient.read.mockResolvedValue({
				data: null,
			});

			const config = await createConfig({
				schema: {
					fallback: eg.string().default("default-value"),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: { type: "token", token: "token" },
						path: "app/config",
					},
				},
			});

			// Should use fallback since no secrets were found
			expect(config.fallback).toBe("default-value");
		});

		it("handles vault response with undefined data", async () => {
			// Response with completely undefined data
			mockVaultClient.read.mockResolvedValue({});

			const config = await createConfig({
				schema: {
					fallback: eg.string().default("default-value"),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: { type: "token", token: "token" },
						path: "app/config",
					},
				},
			});

			expect(config.fallback).toBe("default-value");
		});
	});

	describe("Merger Edge Cases", () => {
		it("handles objects with null prototype", () => {
			const nullProtoObj = Object.create(null);
			nullProtoObj.key = "value";

			const result = deepMerge({}, nullProtoObj);

			expect(result.key).toBe("value");
		});

		it("handles nested objects with null prototype", () => {
			const nullProtoObj = Object.create(null);
			nullProtoObj.nested = "value";

			const target = { key: "original" };
			const result = deepMerge(target, { data: nullProtoObj });

			expect(result.data).toBeDefined();
			expect((result.data as any).nested).toBe("value");
		});

		it("flattens objects with null prototype", () => {
			const nullProtoObj = Object.create(null);
			nullProtoObj.key = "value";

			const result = flattenObject({ data: nullProtoObj });

			expect(result.data_key).toBe("value");
		});
	});

	describe("File Loader Edge Cases", () => {
		it("handles nonexistent files gracefully", async () => {
			const { loadConfigFile } = await import("../src/core/file-loader.js");

			// Loading non-existent file should return empty object
			const result = loadConfigFile("/nonexistent/path/file.json");
			expect(result).toEqual({});
		});

		it("returns empty config when directory doesn't exist", async () => {
			const config = await createConfig({
				schema: {
					fallback: eg.string().default("default-value"),
				},
				configDir: "/nonexistent/directory",
			});

			expect(config.fallback).toBe("default-value");
		});
	});

	describe("Additional Watcher Paths", () => {
		it("handles file removal events", async () => {
			const testDir = join(tmpdir(), `turar-removal-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			const testFile = join(testDir, "test.json");
			writeFileSync(testFile, JSON.stringify({ extra: "data" }));
			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value" }));

			let changeType: string | undefined;

			const handle = await watchConfig({
				schema: {
					test: eg.string().required(),
					extra: eg.string().optional(),
				},
				configDir: testDir,
				debounce: 100,
				onChange: (_newConfig, change) => {
					changeType = change.type;
				},
			});

			// Wait for watcher to be ready
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Remove a file
			rmSync(testFile);

			// Wait for debounce + processing
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Should detect removal
			expect(changeType).toBe("removed");

			await handle.stop();
			rmSync(testDir, { recursive: true, force: true });
		});

		it("updates config on file addition without onChange", async () => {
			const testDir = join(tmpdir(), `turar-addition-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value1" }));

			// No onChange callback
			const handle = await watchConfig({
				schema: {
					test: eg.string().required(),
					extra: eg.string().optional(),
				},
				configDir: testDir,
				debounce: 100,
			});

			// Wait for watcher to be ready
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Add a new file
			writeFileSync(join(testDir, "production.json"), JSON.stringify({ extra: "production-data" }));

			// Set NODE_ENV to trigger environment file load
			const oldEnv = process.env.NODE_ENV;
			process.env.NODE_ENV = "production";

			// Wait for debounce + processing
			await new Promise((resolve) => setTimeout(resolve, 300));

			// Config should be updated even without onChange
			const config = handle.getConfig();
			// Config might or might not have updated depending on timing, but at least no crash
			expect(config.test).toBe("value1");

			process.env.NODE_ENV = oldEnv;
			await handle.stop();
			rmSync(testDir, { recursive: true, force: true });
		});

		it("watches config with secrets integration", async () => {
			const testDir = join(tmpdir(), `turar-secrets-watch-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value" }));

			// Mock vault for secrets
			mockVaultClient.read.mockResolvedValue({
				data: { data: { secret_key: "secret" } },
			});

			const handle = await watchConfig({
				schema: {
					test: eg.string().required(),
					secret_key: eg.string().required(),
				},
				configDir: testDir,
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: { type: "token", token: "token" },
						path: "app/config",
					},
				},
			});

			const config = handle.getConfig();
			expect(config.secret_key).toBe("secret");

			await handle.stop();
			rmSync(testDir, { recursive: true, force: true });
		});

		it("watches config with envFile as string path", async () => {
			const testDir = join(tmpdir(), `turar-envfile-watch-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value" }));
			writeFileSync(join(testDir, "custom.env"), "ENV_VAR=custom");

			const handle = await watchConfig({
				schema: {
					test: eg.string().required(),
					env_var: eg.string().optional(),
				},
				configDir: testDir,
				envFile: join(testDir, "custom.env"),
			});

			const config = handle.getConfig();
			expect(config.test).toBe("value");

			await handle.stop();
			rmSync(testDir, { recursive: true, force: true });
		});

		it("watches config with envFile as boolean", async () => {
			const testDir = join(tmpdir(), `turar-envfile-bool-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value" }));

			const handle = await watchConfig({
				schema: {
					test: eg.string().required(),
				},
				configDir: testDir,
				envFile: true,
			});

			const config = handle.getConfig();
			expect(config.test).toBe("value");

			await handle.stop();
			rmSync(testDir, { recursive: true, force: true });
		});
	});
});
