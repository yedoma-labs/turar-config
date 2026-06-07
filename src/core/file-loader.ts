import { readFileSync, realpathSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
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
		// ENOENT is not an error - file doesn't exist, return empty object
		if ((err as NodeJS.ErrnoException).code === "ENOENT") {
			return {};
		}
		if (err instanceof SyntaxError) {
			throw new ConfigFileError("Invalid JSON syntax", basename(resolvedPath), err);
		}
		throw new ConfigFileError("Failed to read config file", basename(resolvedPath), err);
	}
}

export function loadConfigFiles(
	configDir: string,
	environmentName?: string,
): { base: Record<string, unknown>; environment: Record<string, unknown> } {
	// Validate environment name to prevent path traversal
	if (environmentName && !/^[a-zA-Z0-9_-]+$/.test(environmentName)) {
		throw new ConfigFileError(
			"Invalid environment name - must be alphanumeric with hyphens/underscores only",
			environmentName,
		);
	}

	const resolvedConfigDir = resolve(configDir);
	// Resolve to real path to prevent symlink attacks
	let realConfigDir: string;
	try {
		realConfigDir = realpathSync(resolvedConfigDir);
	} catch (err) {
		// If directory doesn't exist, use resolved path for validation
		realConfigDir = resolvedConfigDir;
	}

	const baseFile = resolve(realConfigDir, "default.json");
	// Validate base file is within config directory
	try {
		const realBase = realpathSync.native ? realpathSync.native(baseFile) : baseFile;
		if (!realBase.startsWith(realConfigDir)) {
			throw new ConfigFileError("Path traversal detected", "default.json");
		}
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
			if (err instanceof ConfigFileError) throw err;
			// If we can't resolve, validate the constructed path at least
			if (!baseFile.startsWith(realConfigDir)) {
				throw new ConfigFileError("Path traversal detected", "default.json");
			}
		}
	}
	const base = loadJsonFile(baseFile);

	let environment: Record<string, unknown> = {};
	if (environmentName) {
		const envFile = resolve(realConfigDir, `${environmentName}.json`);
		// Validate environment file is within config directory
		try {
			const realEnv = realpathSync.native ? realpathSync.native(envFile) : envFile;
			if (!realEnv.startsWith(realConfigDir)) {
				throw new ConfigFileError("Path traversal detected", `${environmentName}.json`);
			}
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
				if (err instanceof ConfigFileError) throw err;
				// If we can't resolve, validate the constructed path at least
				if (!envFile.startsWith(realConfigDir)) {
					throw new ConfigFileError("Path traversal detected", `${environmentName}.json`);
				}
			}
		}
		environment = loadJsonFile(envFile);
	}

	return { base, environment };
}
