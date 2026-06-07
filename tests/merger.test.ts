import { describe, expect, it } from "vitest";
import { deepMerge, flattenObject } from "../src/core/merger.js";

describe("deepMerge", () => {
	it("merges two objects", () => {
		const result = deepMerge({ a: 1 }, { b: 2 });
		expect(result).toEqual({ a: 1, b: 2 });
	});

	it("overwrites primitive values", () => {
		const result = deepMerge({ a: 1, b: 2 }, { b: 3 });
		expect(result).toEqual({ a: 1, b: 3 });
	});

	it("deep merges nested objects", () => {
		const result = deepMerge(
			{ server: { host: "localhost", port: 3000 } },
			{ server: { port: 8080 } },
		);
		expect(result).toEqual({ server: { host: "localhost", port: 8080 } });
	});

	it("handles multiple sources", () => {
		const result = deepMerge({ a: 1 }, { b: 2 }, { c: 3 });
		expect(result).toEqual({ a: 1, b: 2, c: 3 });
	});

	it("later sources win", () => {
		const result = deepMerge({ a: 1 }, { a: 2 }, { a: 3 });
		expect(result).toEqual({ a: 3 });
	});

	it("preserves arrays without merging", () => {
		const result = deepMerge({ items: [1, 2] }, { items: [3, 4] });
		expect(result).toEqual({ items: [3, 4] });
	});

	it("skips undefined values", () => {
		const result = deepMerge({ a: 1, b: 2 }, { b: undefined, c: 3 });
		expect(result).toEqual({ a: 1, b: 2, c: 3 });
	});

	it("handles empty source", () => {
		const result = deepMerge({ a: 1 }, {});
		expect(result).toEqual({ a: 1 });
	});

	it("handles deeply nested merge", () => {
		const result = deepMerge(
			{
				level1: {
					level2: {
						level3: {
							a: 1,
							b: 2,
						},
					},
				},
			},
			{
				level1: {
					level2: {
						level3: {
							b: 3,
							c: 4,
						},
					},
				},
			},
		);

		expect(result).toEqual({
			level1: {
				level2: {
					level3: {
						a: 1,
						b: 3,
						c: 4,
					},
				},
			},
		});
	});

	it("does not merge Date objects", () => {
		const date1 = new Date("2024-01-01");
		const date2 = new Date("2024-12-31");
		const result = deepMerge({ created: date1 }, { created: date2 });
		expect(result).toEqual({ created: date2 });
	});
});

describe("flattenObject", () => {
	it("flattens nested object", () => {
		const result = flattenObject({
			database: {
				host: "localhost",
				port: 5432,
			},
		});
		expect(result).toEqual({
			database_host: "localhost",
			database_port: "5432",
		});
	});

	it("uses custom separator", () => {
		const result = flattenObject(
			{
				database: {
					host: "localhost",
				},
			},
			"",
			"__",
		);
		expect(result).toEqual({
			database__host: "localhost",
		});
	});

	it("handles prefix", () => {
		const result = flattenObject(
			{
				host: "localhost",
			},
			"db",
		);
		expect(result).toEqual({
			db_host: "localhost",
		});
	});

	it("skips null and undefined values", () => {
		const result = flattenObject({
			a: null,
			b: undefined,
			c: "value",
		});
		expect(result).toEqual({
			c: "value",
		});
	});

	it("converts all values to strings", () => {
		const result = flattenObject({
			port: 3000,
			enabled: true,
			ratio: 0.5,
		});
		expect(result).toEqual({
			port: "3000",
			enabled: "true",
			ratio: "0.5",
		});
	});

	it("handles deeply nested structures", () => {
		const result = flattenObject({
			level1: {
				level2: {
					level3: {
						value: "deep",
					},
				},
			},
		});
		expect(result).toEqual({
			level1_level2_level3_value: "deep",
		});
	});

	it("handles arrays as values", () => {
		const result = flattenObject({
			tags: ["web", "api"],
		});
		expect(result).toEqual({
			tags: "web,api",
		});
	});
});
