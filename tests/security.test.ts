import { describe, expect, it } from "vitest";
import { loadConfigFiles } from "../src/core/file-loader.js";
import { interpolateObject, interpolateValue } from "../src/core/interpolator.js";
import { deepMerge } from "../src/core/merger.js";
import { ConfigFileError, ConfigInterpolationError } from "../src/errors.js";

describe("Security Tests", () => {
	describe("Path Traversal Protection", () => {
		it("rejects environment names with path traversal", () => {
			expect(() => loadConfigFiles("./tests/fixtures/config", "../etc")).toThrow(ConfigFileError);
			expect(() => loadConfigFiles("./tests/fixtures/config", "../etc")).toThrow(
				/Invalid environment name/,
			);
		});

		it("rejects environment names with absolute paths", () => {
			expect(() => loadConfigFiles("./tests/fixtures/config", "/etc/passwd")).toThrow(
				ConfigFileError,
			);
		});

		it("rejects environment names with relative path prefixes", () => {
			expect(() => loadConfigFiles("./tests/fixtures/config", "./test")).toThrow(ConfigFileError);
		});

		it("rejects environment names with null bytes", () => {
			expect(() => loadConfigFiles("./tests/fixtures/config", "test\0")).toThrow(ConfigFileError);
		});

		it("rejects empty environment names", () => {
			expect(() => loadConfigFiles("./tests/fixtures/config", "")).toThrow(ConfigFileError);
			expect(() => loadConfigFiles("./tests/fixtures/config", "")).toThrow(
				/Invalid environment name/,
			);
		});

		it("rejects environment names with special characters", () => {
			expect(() => loadConfigFiles("./tests/fixtures/config", "test/../etc")).toThrow(
				ConfigFileError,
			);
			expect(() => loadConfigFiles("./tests/fixtures/config", "test/subdir")).toThrow(
				ConfigFileError,
			);
			expect(() => loadConfigFiles("./tests/fixtures/config", "test\\subdir")).toThrow(
				ConfigFileError,
			);
		});

		it("accepts valid environment names", () => {
			expect(() => loadConfigFiles("./tests/fixtures/config", "test")).not.toThrow();
			expect(() => loadConfigFiles("./tests/fixtures/config", "production")).not.toThrow();
			expect(() => loadConfigFiles("./tests/fixtures/config", "dev-123")).not.toThrow();
			expect(() => loadConfigFiles("./tests/fixtures/config", "staging_v2")).not.toThrow();
		});

		it("sanitizes paths in error messages", () => {
			try {
				loadConfigFiles("./tests/fixtures/config", "../etc");
			} catch (err) {
				if (err instanceof ConfigFileError) {
					expect(err.message.length).toBeLessThan(100);
				}
			}
		});
	});

	describe("Prototype Pollution Protection", () => {
		it("filters __proto__ key in merge", () => {
			const target = {};
			const malicious = { __proto__: { polluted: true } };

			const result = deepMerge(target, malicious);

			expect(Object.prototype).not.toHaveProperty("polluted");
			expect(result).not.toHaveProperty("__proto__");
		});

		it("filters constructor key in merge", () => {
			const target = {};
			const malicious = { constructor: { polluted: true } };

			const result = deepMerge(target, malicious);

			expect(result).not.toHaveProperty("constructor");
		});

		it("filters prototype key in merge", () => {
			const target = {};
			const malicious = { prototype: { polluted: true } };

			const result = deepMerge(target, malicious);

			expect(result).not.toHaveProperty("prototype");
		});

		it("filters nested pollution attempts", () => {
			const target = { safe: {} };
			const malicious = {
				safe: {
					nested: {
						__proto__: { polluted: true },
					},
				},
			};

			deepMerge(target, malicious);

			expect(Object.prototype).not.toHaveProperty("polluted");
		});

		it("allows legitimate keys that contain proto", () => {
			const target = {};
			const source = { myProto: "value", proto_field: 123 };

			const result = deepMerge(target, source);

			expect(result.myProto).toBe("value");
			expect(result.proto_field).toBe(123);
		});
	});

	describe("DoS Protection - Depth Limits", () => {
		it("throws on deeply nested objects in deepMerge (>100 levels)", () => {
			let deepObj1: Record<string, unknown> = { value: "a" };
			for (let i = 0; i < 102; i++) {
				deepObj1 = { level: deepObj1 };
			}
			let deepObj2: Record<string, unknown> = { value: "b" };
			for (let i = 0; i < 102; i++) {
				deepObj2 = { level: deepObj2 };
			}

			expect(() => deepMerge(deepObj1, deepObj2)).toThrow(/Maximum nesting depth exceeded/);
		});

		it("allows objects nested exactly 100 levels in deepMerge", () => {
			let deepObj: Record<string, unknown> = { value: "deep" };
			for (let i = 0; i < 100; i++) {
				deepObj = { nested: deepObj };
			}

			expect(() => deepMerge({}, deepObj)).not.toThrow();
		});

		it("throws on deeply nested objects in interpolateObject (>100 levels)", () => {
			let deepObj: Record<string, unknown> = { value: "${TEST}" };
			for (let i = 0; i < 105; i++) {
				deepObj = { nested: deepObj };
			}

			expect(() => interpolateObject(deepObj, { TEST: "value" })).toThrow(
				/Maximum nesting depth exceeded/,
			);
		});

		it("allows objects nested exactly 100 levels in interpolateObject", () => {
			let deepObj: Record<string, unknown> = { value: "${TEST}" };
			for (let i = 0; i < 100; i++) {
				deepObj = { nested: deepObj };
			}

			expect(() => interpolateObject(deepObj, { TEST: "value" })).not.toThrow();
		});

		it("counts depth correctly through arrays", () => {
			let deepObj: Record<string, unknown> = { value: "${TEST}" };
			for (let i = 0; i < 105; i++) {
				deepObj = { arr: [deepObj] };
			}

			expect(() => interpolateObject(deepObj, { TEST: "value" })).toThrow(ConfigInterpolationError);
		});
	});

	describe("DoS Protection - String Length Limits", () => {
		it("throws on strings longer than 10000 chars", () => {
			const longString = "a".repeat(10001);

			expect(() => interpolateValue(longString, {})).toThrow(ConfigInterpolationError);
			expect(() => interpolateValue(longString, {})).toThrow(/String too long/);
		});

		it("allows strings exactly 10000 chars", () => {
			const maxString = "a".repeat(10000);

			expect(() => interpolateValue(maxString, {})).not.toThrow();
		});

		it("allows strings shorter than 10000 chars", () => {
			const shortString = "a".repeat(9999);

			expect(() => interpolateValue(shortString, {})).not.toThrow();
		});

		it("checks length before interpolation", () => {
			const longString = "${VAR}".repeat(2000); // > 10000 chars before interpolation

			expect(() => interpolateValue(longString, { VAR: "x" })).toThrow(ConfigInterpolationError);
		});
	});

	describe("Error Message Sanitization", () => {
		it("limits path length in ConfigFileError messages", () => {
			const longPath = `/very/long/path/${"a".repeat(100)}/config.json`;
			const error = new ConfigFileError("Test error", longPath);

			expect(error.message.length).toBeLessThan(150);
			expect(error.message).toContain("...");
		});

		it("preserves short paths in error messages", () => {
			const shortPath = "./config.json";
			const error = new ConfigFileError("Test error", shortPath);

			expect(error.message).toContain(shortPath);
			expect(error.message).not.toContain("...");
		});
	});

	describe("TOCTOU Prevention", () => {
		it("handles missing files without race condition", () => {
			const result = loadConfigFiles("./nonexistent-dir", "test");

			expect(result.base).toEqual({});
			expect(result.environment).toEqual({});
		});

		it("handles missing environment file gracefully", () => {
			const result = loadConfigFiles("./tests/fixtures/config", "nonexistent");

			expect(result.environment).toEqual({});
		});
	});

	describe("Input Validation Edge Cases", () => {
		it("accepts very long valid environment names", () => {
			const longName = "a".repeat(100);

			const result = loadConfigFiles("./tests/fixtures/config", longName);
			expect(result.environment).toEqual({});
		});

		it("handles environment names with valid special chars", () => {
			expect(() => loadConfigFiles("./tests/fixtures/config", "test-123")).not.toThrow();
			expect(() => loadConfigFiles("./tests/fixtures/config", "prod_v2")).not.toThrow();
			expect(() => loadConfigFiles("./tests/fixtures/config", "staging-2024")).not.toThrow();
		});
	});
});
