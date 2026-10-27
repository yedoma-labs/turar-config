import { describe, expect, it } from "vitest";
import { interpolateObject, interpolateValue } from "../src/core/interpolator.js";
import { ConfigInterpolationError } from "../src/errors.js";

describe("interpolateValue", () => {
	it("interpolates environment variables", () => {
		const result = interpolateValue("Hello ${NAME}", { NAME: "World" });
		expect(result).toBe("Hello World");
	});

	it("interpolates multiple variables", () => {
		const result = interpolateValue("${PROTO}://${HOST}:${PORT}", {
			PROTO: "https",
			HOST: "example.com",
			PORT: "443",
		});
		expect(result).toBe("https://example.com:443");
	});

	it("handles escaped variables", () => {
		const result = interpolateValue("Literal \\${VAR} and ${REAL}", { REAL: "value" });
		expect(result).toBe("Literal ${VAR} and value");
	});

	it("throws on undefined variable", () => {
		expect(() => interpolateValue("${MISSING}", {})).toThrow(ConfigInterpolationError);
		expect(() => interpolateValue("${MISSING}", {})).toThrow(/MISSING/);
	});

	it("returns non-string values unchanged", () => {
		expect(interpolateValue(42, {})).toBe(42);
		expect(interpolateValue(true, {})).toBe(true);
		expect(interpolateValue(null, {})).toBe(null);
	});

	it("handles empty string", () => {
		expect(interpolateValue("", {})).toBe("");
	});

	describe("fallback syntax ${VAR:-fallback}", () => {
		it("uses the fallback when the variable is unset", () => {
			expect(interpolateValue("${PORT:-3000}", {})).toBe("3000");
		});

		it("uses the fallback when the variable is empty", () => {
			expect(interpolateValue("${PORT:-3000}", { PORT: "" })).toBe("3000");
		});

		it("prefers the variable value when it is set", () => {
			expect(interpolateValue("${PORT:-3000}", { PORT: "8080" })).toBe("8080");
		});

		it("allows an empty fallback", () => {
			expect(interpolateValue("[${OPT:-}]", {})).toBe("[]");
		});

		it("keeps colons and further ':-' inside the fallback", () => {
			expect(interpolateValue("${URL:-http://localhost:8080}", {})).toBe("http://localhost:8080");
			expect(interpolateValue("${A:-x:-y}", {})).toBe("x:-y");
		});

		it("still throws when unset and no fallback is given", () => {
			expect(() => interpolateValue("${MISSING}", { OTHER: "1" })).toThrow(/MISSING/);
		});

		it("does not change an empty value without fallback", () => {
			expect(interpolateValue("${EMPTY}", { EMPTY: "" })).toBe("");
		});

		it("combines fallbacks with other variables in one string", () => {
			expect(
				interpolateValue("postgresql://${DB_HOST:-localhost}:${DB_PORT:-5432}/app", {
					DB_PORT: "6543",
				}),
			).toBe("postgresql://localhost:6543/app");
		});

		it("keeps escaped fallback syntax literal", () => {
			expect(interpolateValue("\\${VAR:-x}", {})).toBe("${VAR:-x}");
		});

		it("applies fallbacks inside nested objects and arrays", () => {
			const result = interpolateObject(
				{ server: { port: "${PORT:-3000}" }, hosts: ["${HOST:-a.local}"] },
				{},
			);
			expect(result).toEqual({ server: { port: "3000" }, hosts: ["a.local"] });
		});
	});
});

describe("interpolateObject", () => {
	it("interpolates nested objects", () => {
		const result = interpolateObject(
			{
				server: {
					host: "${HOST}",
					port: "${PORT}",
				},
			},
			{ HOST: "localhost", PORT: "3000" },
		);

		expect(result).toEqual({
			server: {
				host: "localhost",
				port: "3000",
			},
		});
	});

	it("interpolates arrays", () => {
		const result = interpolateObject(
			{
				urls: ["${URL1}", "${URL2}"],
			},
			{ URL1: "http://a.com", URL2: "http://b.com" },
		);

		expect(result).toEqual({
			urls: ["http://a.com", "http://b.com"],
		});
	});

	it("interpolates objects in arrays", () => {
		const result = interpolateObject(
			{
				servers: [
					{ host: "${HOST1}", port: 80 },
					{ host: "${HOST2}", port: 443 },
				],
			},
			{ HOST1: "server1", HOST2: "server2" },
		);

		expect(result).toEqual({
			servers: [
				{ host: "server1", port: 80 },
				{ host: "server2", port: 443 },
			],
		});
	});

	it("preserves non-string values", () => {
		const result = interpolateObject(
			{
				count: 42,
				enabled: true,
				data: null,
			},
			{},
		);

		expect(result).toEqual({
			count: 42,
			enabled: true,
			data: null,
		});
	});

	it("handles deeply nested structures", () => {
		const result = interpolateObject(
			{
				level1: {
					level2: {
						level3: {
							value: "${VAR}",
						},
					},
				},
			},
			{ VAR: "deep" },
		);

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
