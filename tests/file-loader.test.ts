import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadConfigFiles, loadJsonFile } from "../src/core/file-loader.js";
import { ConfigFileError } from "../src/errors.js";

describe("loadJsonFile", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = join(tmpdir(), `turar-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("returns empty object for missing file", () => {
		const result = loadJsonFile(join(testDir, "missing.json"));
		expect(result).toEqual({});
	});

	it("loads valid JSON file", () => {
		const filePath = join(testDir, "valid.json");
		writeFileSync(filePath, JSON.stringify({ foo: "bar", nested: { value: 42 } }));

		const result = loadJsonFile(filePath);
		expect(result).toEqual({ foo: "bar", nested: { value: 42 } });
	});

	it("throws ConfigFileError for invalid JSON", () => {
		const filePath = join(testDir, "invalid.json");
		writeFileSync(filePath, "{ invalid json }");

		expect(() => loadJsonFile(filePath)).toThrow(ConfigFileError);
		expect(() => loadJsonFile(filePath)).toThrow(/Invalid JSON syntax/);
	});

	it("throws ConfigFileError for non-object JSON", () => {
		const filePath = join(testDir, "array.json");
		writeFileSync(filePath, JSON.stringify([1, 2, 3]));

		expect(() => loadJsonFile(filePath)).toThrow(ConfigFileError);
		expect(() => loadJsonFile(filePath)).toThrow(/must contain a JSON object/);
	});

	it("throws ConfigFileError for primitive JSON", () => {
		const filePath = join(testDir, "string.json");
		writeFileSync(filePath, JSON.stringify("just a string"));

		expect(() => loadJsonFile(filePath)).toThrow(ConfigFileError);
	});

	it("handles nested objects", () => {
		const filePath = join(testDir, "nested.json");
		writeFileSync(
			filePath,
			JSON.stringify({
				level1: {
					level2: {
						level3: {
							value: "deep",
						},
					},
				},
			}),
		);

		const result = loadJsonFile(filePath);
		expect(result).toEqual({
			level1: {
				level2: {
					level3: {
						value: "deep",
					},
				},
			},
		});
	});
});

describe("loadConfigFiles", () => {
	it("loads base config from fixtures", () => {
		const { base, environment } = loadConfigFiles("tests/fixtures/config");

		expect(base).toMatchObject({
			database: {
				host: "localhost",
				port: 5432,
			},
		});
		expect(environment).toEqual({});
	});

	it("loads environment-specific config", () => {
		const { base, environment } = loadConfigFiles("tests/fixtures/config", "test");

		expect(base).toMatchObject({
			database: {
				host: "localhost",
			},
		});
		expect(environment).toMatchObject({
			database: {
				host: "test-db",
				name: "test_db",
			},
		});
	});

	it("returns empty environment config if not found", () => {
		const { base, environment } = loadConfigFiles("tests/fixtures/config", "nonexistent");

		expect(base).toBeTruthy();
		expect(environment).toEqual({});
	});
});
