import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadConfigFiles } from "../src/core/file-loader.js";
import { interpolateObject, interpolateValue } from "../src/core/interpolator.js";
import { deepMerge, flattenObject } from "../src/core/merger.js";
import {
	ConfigFileError,
	ConfigInterpolationError,
	ConfigSecretError,
	createConfig,
} from "../src/index.js";

// Mock node-vault for vault tests
vi.mock("node-vault", () => ({
	default: vi.fn(),
}));

describe("Enhanced Security Tests", () => {
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

	describe("ReDoS Prevention", () => {
		it("handles large interpolation strings without hanging", () => {
			const env = { VAR: "x" };

			// Create string with many ${VAR} references
			const template = "${VAR}".repeat(1000);

			// Should complete in reasonable time (not catastrophic backtracking)
			const start = Date.now();
			const result = interpolateValue(template, env);
			const duration = Date.now() - start;

			expect(duration).toBeLessThan(1000); // Should be fast
			expect(result).toBe("x".repeat(1000));
		});

		it("handles nested braces without DoS", () => {
			const env = { A: "value" };

			// Patterns that could cause ReDoS with naive regex
			const tests = [
				"${{{{A}}}}", // Nested braces
				`\${${"$".repeat(100)}}`, // Many $ chars
				`\${A${"{".repeat(100)}`, // Many { without close
			];

			for (const template of tests) {
				const start = Date.now();
				try {
					interpolateValue(template, env);
				} catch {
					// Errors are OK, just shouldn't hang
				}
				const duration = Date.now() - start;
				expect(duration).toBeLessThan(100);
			}
		});

		it("prevents expansion attacks", () => {
			const env = { BIG: "x".repeat(5000) };

			// Template that expands beyond limit
			const template = "${BIG}${BIG}${BIG}";

			expect(() => interpolateValue(template, env)).toThrow(ConfigInterpolationError);
			expect(() => interpolateValue(template, env)).toThrow(/maximum length/);
		});
	});

	describe("Circular Reference Detection", () => {
		it("detects circular references in objects", () => {
			const env = { VAR: "value" };
			const obj: any = { a: 1 };
			obj.circular = obj; // Create cycle

			expect(() => interpolateObject(obj, env)).toThrow(ConfigInterpolationError);
			expect(() => interpolateObject(obj, env)).toThrow(/circular reference/i);
		});

		it("detects circular references through arrays", () => {
			const env = { VAR: "value" };
			const obj: any = { arr: [] };
			const nested = { ref: obj };
			obj.arr.push(nested); // Create cycle through array

			expect(() => interpolateObject(obj, env)).toThrow(ConfigInterpolationError);
		});

		it("detects deep circular references", () => {
			const env = { VAR: "value" };
			const obj: any = { a: { b: { c: {} } } };
			obj.a.b.c.back = obj; // Deep cycle

			expect(() => interpolateObject(obj, env)).toThrow(ConfigInterpolationError);
		});
	});

	describe("File Size Limits", () => {
		it("rejects files larger than 10MB", async () => {
			const testDir = join(tmpdir(), `turar-filesize-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			// Create a large JSON file (simulate 11MB)
			const largeData = { data: "x".repeat(11 * 1024 * 1024) };
			writeFileSync(join(testDir, "default.json"), JSON.stringify(largeData));

			await expect(
				createConfig({
					schema: { data: eg.string().optional() },
					configDir: testDir,
				}),
			).rejects.toThrow(ConfigFileError);

			await expect(
				createConfig({
					schema: { data: eg.string().optional() },
					configDir: testDir,
				}),
			).rejects.toThrow(/maximum size/);

			rmSync(testDir, { recursive: true, force: true });
		});

		it("accepts files just under limit", async () => {
			const testDir = join(tmpdir(), `turar-filesize-ok-${Date.now()}`);
			mkdirSync(testDir, { recursive: true });

			// Create a file under 10MB but with small string values (< 10k per string)
			const data: any = {};
			for (let i = 0; i < 1000; i++) {
				data[`key${i}`] = "x".repeat(5000); // 5KB per value
			}
			writeFileSync(join(testDir, "default.json"), JSON.stringify(data));

			const schema: any = {};
			for (let i = 0; i < 1000; i++) {
				schema[`key${i}`] = eg.string().optional();
			}

			const config = await createConfig({
				schema,
				configDir: testDir,
			});

			expect(Object.keys(config).length).toBeGreaterThan(0);
			rmSync(testDir, { recursive: true, force: true });
		});
	});

	describe("Vault Security", () => {
		it("rejects non-HTTP(S) Vault URLs", async () => {
			await expect(
				createConfig({
					schema: { test: eg.string().optional() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "file:///etc/passwd", // File protocol
							auth: { type: "token", token: "token" },
							path: "app/config",
						},
					},
				}),
			).rejects.toThrow(ConfigSecretError);

			await expect(
				createConfig({
					schema: { test: eg.string().optional() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "ftp://evil.com/vault", // FTP protocol
							auth: { type: "token", token: "token" },
							path: "app/config",
						},
					},
				}),
			).rejects.toThrow(/protocol/);
		});

		it("rejects Vault URLs without hostname", async () => {
			await expect(
				createConfig({
					schema: { test: eg.string().optional() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://", // No hostname
							auth: { type: "token", token: "token" },
							path: "app/config",
						},
					},
				}),
			).rejects.toThrow(ConfigSecretError);
		});

		it("rejects Vault paths with traversal", async () => {
			await expect(
				createConfig({
					schema: { test: eg.string().optional() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://localhost:8200",
							auth: { type: "token", token: "token" },
							path: "../../etc/passwd",
						},
					},
				}),
			).rejects.toThrow(ConfigSecretError);

			await expect(
				createConfig({
					schema: { test: eg.string().optional() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://localhost:8200",
							auth: { type: "token", token: "token" },
							path: "../../etc/passwd",
						},
					},
				}),
			).rejects.toThrow(/traversal/);
		});

		it("rejects Vault paths with invalid characters", async () => {
			await expect(
				createConfig({
					schema: { test: eg.string().optional() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://localhost:8200",
							auth: { type: "token", token: "token" },
							path: "app/config;rm -rf /",
						},
					},
				}),
			).rejects.toThrow(ConfigSecretError);

			await expect(
				createConfig({
					schema: { test: eg.string().optional() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://localhost:8200",
							auth: { type: "token", token: "token" },
							path: "app/config\x00null",
						},
					},
				}),
			).rejects.toThrow(/unsafe characters/);
		});

		it("handles deeply nested vault secrets", async () => {
			// Create deeply nested structure at max depth
			let nested: any = { value: "deep" };
			for (let i = 0; i < 99; i++) {
				nested = { level: nested };
			}

			mockVaultClient.read.mockResolvedValue({
				data: { data: nested },
			});

			const config = await createConfig({
				schema: {
					level_level_level_level_level_level_value: eg.string().optional(),
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

			// Should handle max depth
			expect(config).toBeDefined();
		});

		it("rejects vault secrets exceeding max depth", async () => {
			// Create deeply nested structure beyond max depth
			let nested: any = { value: "too-deep" };
			for (let i = 0; i < 101; i++) {
				nested = { level: nested };
			}

			mockVaultClient.read.mockResolvedValue({
				data: { data: nested },
			});

			await expect(
				createConfig({
					schema: { test: eg.string().optional() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://localhost:8200",
							auth: { type: "token", token: "token" },
							path: "app/config",
						},
					},
				}),
			).rejects.toThrow(ConfigSecretError);

			await expect(
				createConfig({
					schema: { test: eg.string().optional() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://localhost:8200",
							auth: { type: "token", token: "token" },
							path: "app/config",
						},
					},
				}),
			).rejects.toThrow(/maximum nesting depth/i);
		});
	});

	describe("Separator Validation", () => {
		it("rejects empty separator in flattenObject", () => {
			const obj = { a: { b: "value" } };

			expect(() => flattenObject(obj, "", "")).toThrow(/separator cannot be empty/i);
		});

		it("rejects alphanumeric separator", () => {
			const obj = { a: { b: "value" } };

			expect(() => flattenObject(obj, "", "x")).toThrow(/alphanumeric/i);
			expect(() => flattenObject(obj, "", "9")).toThrow(/alphanumeric/i);
			expect(() => flattenObject(obj, "", "A")).toThrow(/alphanumeric/i);
		});

		it("accepts valid separators", () => {
			const obj = { a: { b: "value" } };

			// These should work
			expect(flattenObject(obj, "", "_")).toEqual({ a_b: "value" });
			expect(flattenObject(obj, "", "-")).toEqual({ "a-b": "value" });
			expect(flattenObject(obj, "", ".")).toEqual({ "a.b": "value" });
			expect(flattenObject(obj, "", ":")).toEqual({ "a:b": "value" });
		});
	});

	describe("Prototype Pollution Variations", () => {
		it("blocks __proto__ variations", () => {
			const target = {};
			const malicious = {
				__proto__: { polluted: "yes" },
				___proto__: { polluted: "yes" },
				__proto: { polluted: "yes" },
			};

			const result = deepMerge(target, malicious);

			// None of these dangerous keys should be copied
			expect(Object.hasOwn(result, "__proto__")).toBe(false);
			expect(Object.hasOwn(result, "___proto__")).toBe(false);
			expect(Object.hasOwn(result, "__proto")).toBe(false);
			// Prototype should not be polluted
			expect((result as any).polluted).toBeUndefined();
		});

		it("blocks constructor variations", () => {
			const target = {};
			const malicious = {
				constructor: { polluted: "yes" },
				CONSTRUCTOR: { polluted: "yes" },
			};

			const result = deepMerge(target, malicious);

			// These dangerous keys should not be copied
			expect(Object.hasOwn(result, "constructor")).toBe(false);
			expect(Object.hasOwn(result, "CONSTRUCTOR")).toBe(false);
		});

		it("blocks prototype variations", () => {
			const target = {};
			const malicious = {
				prototype: { polluted: "yes" },
				PROTOTYPE: { polluted: "yes" },
			};

			const result = deepMerge(target, malicious);

			// These dangerous keys should not be copied
			expect(Object.hasOwn(result, "prototype")).toBe(false);
			expect(Object.hasOwn(result, "PROTOTYPE")).toBe(false);
		});
	});

	describe("Windows Path Separators", () => {
		it("rejects backslash in environment names", () => {
			expect(() => loadConfigFiles("./tests/fixtures/config", "test\\subdir")).toThrow(
				ConfigFileError,
			);
			expect(() => loadConfigFiles("./tests/fixtures/config", "..\\..\\etc")).toThrow(
				/path separator/i,
			);
		});
	});
});
