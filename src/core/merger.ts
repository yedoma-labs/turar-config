const MAX_DEPTH = 100;

export function deepMerge(
	target: Record<string, unknown>,
	...sources: Record<string, unknown>[]
): Record<string, unknown> {
	return deepMergeInternal(target, sources, 0);
}

function deepMergeInternal(
	target: Record<string, unknown>,
	sources: Record<string, unknown>[],
	depth: number,
): Record<string, unknown> {
	if (depth > MAX_DEPTH) {
		throw new Error("Maximum nesting depth exceeded in deepMerge");
	}

	if (sources.length === 0) {
		return target;
	}

	const result = { ...target };

	for (const source of sources) {
		for (const [key, value] of Object.entries(source)) {
			if (value === undefined) {
				continue;
			}

			// Block dangerous property names and their variations
			if (
				key === "__proto__" ||
				key === "constructor" ||
				key === "prototype" ||
				key === "___proto__" ||
				key === "__proto" ||
				key === "CONSTRUCTOR" ||
				key === "PROTOTYPE"
			) {
				continue;
			}

			const targetValue = result[key];

			if (isPlainObject(value) && isPlainObject(targetValue)) {
				result[key] = deepMergeInternal(
					targetValue as Record<string, unknown>,
					[value as Record<string, unknown>],
					depth + 1,
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
	depth = 0,
): Record<string, string> {
	// Validate separator to prevent key collisions
	if (separator.length === 0) {
		throw new Error("Separator cannot be empty in flattenObject");
	}
	if (/[a-zA-Z0-9]/.test(separator)) {
		throw new Error("Separator cannot contain alphanumeric characters in flattenObject");
	}

	if (depth > MAX_DEPTH) {
		throw new Error("Maximum nesting depth exceeded in flattenObject");
	}

	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(obj)) {
		const newKey = prefix ? `${prefix}${separator}${key}` : key;

		if (isPlainObject(value)) {
			Object.assign(
				result,
				flattenObject(value as Record<string, unknown>, newKey, separator, depth + 1),
			);
		} else if (value !== undefined && value !== null) {
			result[newKey] = String(value);
		}
	}

	return result;
}
