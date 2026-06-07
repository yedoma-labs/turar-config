import { ConfigInterpolationError } from "../errors.js";

const MAX_STRING_LENGTH = 10000;
const MAX_DEPTH = 100;

/**
 * Interpolate environment variables in a string value.
 * Uses manual parsing to avoid ReDoS vulnerabilities.
 *
 * Syntax:
 * - ${VAR} - Replace with environment variable
 * - \${VAR} - Escape to literal ${VAR}
 *
 * @param value - Value to interpolate (if string)
 * @param envVars - Environment variables
 * @returns Interpolated value
 */
export function interpolateValue(
	value: unknown,
	envVars: Record<string, string | undefined>,
): unknown {
	if (typeof value !== "string") {
		return value;
	}

	if (value.length > MAX_STRING_LENGTH) {
		throw new ConfigInterpolationError(
			"String too long for interpolation",
			`length: ${value.length}`,
		);
	}

	// Manual parsing to avoid ReDoS with regex negative lookbehind
	let result = "";
	let i = 0;
	const len = value.length;

	while (i < len) {
		// Check for escape sequence \${
		if (i < len - 2 && value[i] === "\\" && value[i + 1] === "$" && value[i + 2] === "{") {
			// Escaped ${ - output literal ${
			result += "${";
			i += 3;
			continue;
		}

		// Check for interpolation ${
		if (i < len - 2 && value[i] === "$" && value[i + 1] === "{") {
			// Find closing }
			const closeIdx = value.indexOf("}", i + 2);
			if (closeIdx === -1) {
				// No closing brace, treat as literal
				result += value[i];
				i++;
				continue;
			}

			// Extract variable name
			const varName = value.substring(i + 2, closeIdx);
			if (varName.length === 0) {
				// Empty variable name, treat as literal
				result += value[i];
				i++;
				continue;
			}

			// Look up variable
			const envValue = envVars[varName];
			if (envValue === undefined) {
				throw new ConfigInterpolationError("Undefined environment variable", varName);
			}

			result += envValue;
			i = closeIdx + 1;
		} else {
			result += value[i];
			i++;
		}
	}

	// Check result length to prevent expansion attacks
	if (result.length > MAX_STRING_LENGTH) {
		throw new ConfigInterpolationError(
			`Interpolated string exceeds maximum length of ${MAX_STRING_LENGTH}`,
			`length: ${result.length}`,
		);
	}

	return result;
}

/**
 * Interpolate environment variables in an object recursively.
 * Detects circular references to prevent infinite loops.
 *
 * @param obj - Object to interpolate
 * @param envVars - Environment variables
 * @param depth - Current recursion depth
 * @param visited - Set of visited objects (for cycle detection)
 * @returns Interpolated object
 */
export function interpolateObject(
	obj: Record<string, unknown>,
	envVars: Record<string, string | undefined>,
	depth = 0,
	visited: WeakSet<object> = new WeakSet(),
): Record<string, unknown> {
	if (depth > MAX_DEPTH) {
		throw new ConfigInterpolationError("Maximum nesting depth exceeded", `depth: ${depth}`);
	}

	// Detect circular references
	if (visited.has(obj)) {
		throw new ConfigInterpolationError("Circular reference detected", "object");
	}
	visited.add(obj);

	const result: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(obj)) {
		if (value && typeof value === "object" && !Array.isArray(value)) {
			result[key] = interpolateObject(
				value as Record<string, unknown>,
				envVars,
				depth + 1,
				visited,
			);
		} else if (Array.isArray(value)) {
			result[key] = value.map((item) => {
				if (item && typeof item === "object" && !Array.isArray(item)) {
					return interpolateObject(item as Record<string, unknown>, envVars, depth + 1, visited);
				}
				return interpolateValue(item, envVars);
			});
		} else {
			result[key] = interpolateValue(value, envVars);
		}
	}

	return result;
}
