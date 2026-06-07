import { ConfigInterpolationError } from "../errors.js";

const INTERPOLATION_PATTERN = /(?<!\\)\$\{([^}]+)\}/g;
const ESCAPED_PATTERN = /\\\$\{/g;

export function interpolateValue(
	value: unknown,
	envVars: Record<string, string | undefined>,
): unknown {
	if (typeof value !== "string") {
		return value;
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
	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			result[key] = interpolateObject(value as Record<string, unknown>, envVars);
		} else if (Array.isArray(value)) {
			result[key] = value.map((item) => {
				if (item && typeof item === "object" && !Array.isArray(item)) {
					return interpolateObject(item as Record<string, unknown>, envVars);
				}
				return interpolateValue(item, envVars);
			});
		} else {
			result[key] = interpolateValue(value, envVars);
		}
	}

	return result;
}
