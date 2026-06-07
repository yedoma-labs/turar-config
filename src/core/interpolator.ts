import { ConfigInterpolationError } from "../errors.js";

const INTERPOLATION_PATTERN = /(?<!\\)\$\{([^}]+)\}/g;
const ESCAPED_PATTERN = /\\\$\{/g;
const MAX_DEPTH = 100;
const MAX_STRING_LENGTH = 10000;

export function interpolateValue(
	value: unknown,
	envVars: Record<string, string | undefined>,
): unknown {
	if (typeof value !== "string") {
		return value;
	}

	// Prevent DoS via extremely long strings
	if (value.length > MAX_STRING_LENGTH) {
		throw new ConfigInterpolationError(
			"String exceeds maximum length for interpolation",
			`${value.length} chars`,
		);
	}

	let result = value.replace(INTERPOLATION_PATTERN, (_match, varName: string) => {
		const envValue = envVars[varName];
		if (envValue === undefined) {
			throw new ConfigInterpolationError("Undefined environment variable", varName);
		}
		return envValue;
	});

	result = result.replace(ESCAPED_PATTERN, "${");

	return result;
}

export function interpolateObject(
	obj: Record<string, unknown>,
	envVars: Record<string, string | undefined>,
): Record<string, unknown> {
	return interpolateObjectWithDepth(obj, envVars, 0);
}

function interpolateObjectWithDepth(
	obj: Record<string, unknown>,
	envVars: Record<string, string | undefined>,
	depth: number,
): Record<string, unknown> {
	if (depth > MAX_DEPTH) {
		throw new ConfigInterpolationError(
			"Maximum interpolation depth exceeded",
			`depth: ${depth}`,
		);
	}

	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			result[key] = interpolateObjectWithDepth(value as Record<string, unknown>, envVars, depth + 1);
		} else if (Array.isArray(value)) {
			result[key] = value.map((item) => {
				if (item && typeof item === "object" && !Array.isArray(item)) {
					return interpolateObjectWithDepth(item as Record<string, unknown>, envVars, depth + 1);
				}
				return interpolateValue(item, envVars);
			});
		} else {
			result[key] = interpolateValue(value, envVars);
		}
	}

	return result;
}
