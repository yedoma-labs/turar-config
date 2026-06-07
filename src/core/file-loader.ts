import { readFileSync } from "node:fs";
import { resolve, basename } from "node:path";
import { ConfigFileError } from "../errors.js";

export function loadJsonFile(filePath: string): Record<string, unknown> {
	const resolvedPath = resolve(filePath);

	try {
		const content = readFileSync(resolvedPath, "utf-8");
		const parsed = JSON.parse(content);

		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			throw new ConfigFileError("Config file must contain a JSON object", resolvedPath);
		}

		return parsed as Record<string, unknown>;
	} catch (err) {
		if (err instanceof ConfigFileError) {
			throw err;
		}
		if (err instanceof SyntaxError) {
			throw new ConfigFileError("Invalid JSON syntax", resolvedPath, err);
		}
		if (err instanceof Error && "code" in err && err.code === "ENOENT") {
			return {};
		}
		throw new ConfigFileError("Failed to read config file", resolvedPath, err);
	}
}

export function loadConfigFiles(
	configDir: string,
	environmentName?: string,
): { base: Record<string, unknown>; environment: Record<string, unknown> } {
	if (environmentName && !/^[a-zA-Z0-9_-]+$/.test(environmentName)) {
		throw new ConfigFileError("Invalid environment name", environmentName);
	}

	const baseFile = resolve(configDir, "default.json");
	const base = loadJsonFile(baseFile);

	let environment: Record<string, unknown> = {};
	if (environmentName) {
		const envFile = resolve(configDir, `${environmentName}.json`);
		environment = loadJsonFile(envFile);
	}

	return { base, environment };
}
