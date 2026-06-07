export function deepMerge(
	target: Record<string, unknown>,
	...sources: Record<string, unknown>[]
): Record<string, unknown> {
	if (sources.length === 0) {
		return target;
	}

	const result = { ...target };

	for (const source of sources) {
		for (const [key, value] of Object.entries(source)) {
			if (value === undefined) {
				continue;
			}

			const targetValue = result[key];

			if (isPlainObject(value) && isPlainObject(targetValue)) {
				result[key] = deepMerge(
					targetValue as Record<string, unknown>,
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
