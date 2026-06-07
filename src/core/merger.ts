const MAX_DEPTH = 100;
const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"];

export function deepMerge(
	target: Record<string, unknown>,
	...sources: Record<string, unknown>[]
): Record<string, unknown> {
	return deepMergeWithDepth(target, 0, ...sources);
}

function deepMergeWithDepth(
	target: Record<string, unknown>,
	depth: number,
	...sources: Record<string, unknown>[]
): Record<string, unknown> {
	if (depth > MAX_DEPTH) {
		throw new Error("Maximum merge depth exceeded (possible circular reference)");
	}

	if (sources.length === 0) {
		return target;
	}

	const result = { ...target };

	for (const source of sources) {
		for (const [key, value] of Object.entries(source)) {
			// Prevent prototype pollution
			if (DANGEROUS_KEYS.includes(key)) {
				continue;
			}

			if (value === undefined) {
				continue;
			}

			const targetValue = result[key];

			if (isPlainObject(value) && isPlainObject(targetValue)) {
				result[key] = deepMergeWithDepth(
					targetValue as Record<string, unknown>,
					depth + 1,
					value as Record<string, unknown>,
				);
			} else {
				result[key] = value;
			}
		}
	}

	return result;
}

function isPlainObject(value: unknown): boolean {
	if (typeof value !== "object" || value === null) {
		return false;
	}

	if (Array.isArray(value)) {
		return false;
	}

	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

export function flattenObject(
	obj: Record<string, unknown>,
	prefix = "",
	separator = "_",
): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(obj)) {
		const newKey = prefix ? `${prefix}${separator}${key}` : key;

		if (isPlainObject(value)) {
			Object.assign(result, flattenObject(value as Record<string, unknown>, newKey, separator));
		} else if (value !== undefined && value !== null) {
			result[newKey] = String(value);
		}
	}

	return result;
}
