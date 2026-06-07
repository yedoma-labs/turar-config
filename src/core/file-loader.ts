import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { parse as parseToml } from "@iarna/toml";
import { parse as parseYaml } from "yaml";
import { ConfigFileError } from "../errors.js";

type ConfigFormat = "json" | "yaml" | "toml";

function detectFormat(filePath: string): ConfigFormat {
	const ext = extname(filePath).toLowerCase();
	if (ext === ".yaml" || ext === ".yml") return "yaml";
	if (ext === ".toml") return "toml";
	return "json";
}

function parseContent(
	content: string,
	format: ConfigFormat,
	filePath: string,
): Record<string, unknown> {
	try {
		let parsed: unknown;

		switch (format) {
			case "yaml":
				parsed = parseYaml(content);
				break;
			case "toml":
				parsed = parseToml(content);
				break;
			default:
				parsed = JSON.parse(content);
		}

		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			throw new ConfigFileError("Config file must contain an object", filePath);
		}

		return parsed as Record<string, unknown>;
	} catch (err) {
		if (err instanceof ConfigFileError) {
			throw err;
		}
		throw new ConfigFileError(`Invalid ${format.toUpperCase()} syntax`, filePath, err);
	}
}

export function loadConfigFile(filePath: string): Record<string, unknown> {
	const resolvedPath = resolve(filePath);

	try {
		const content = readFileSync(resolvedPath, "utf-8");
		const format = detectFormat(resolvedPath);
		return parseContent(content, format, resolvedPath);
	} catch (err) {
		if (err instanceof ConfigFileError) {
			throw err;
		}
		if (err instanceof Error && "code" in err && err.code === "ENOENT") {
			return {};
		}
		throw new ConfigFileError("Failed to read config file", resolvedPath, err);
	}
}

function findConfigFile(configDir: string, baseName: string): string | null {
	const extensions = [".yaml", ".yml", ".toml", ".json"];

	for (const ext of extensions) {
		const filePath = resolve(configDir, `${baseName}${ext}`);
		if (existsSync(filePath)) {
			return filePath;
		}
	}

	return null;
}

export function loadConfigFiles(
	configDir: string,
	environmentName?: string,
): { base: Record<string, unknown>; environment: Record<string, unknown> } {
	if (environmentName !== undefined && !/^[a-zA-Z0-9_-]+$/.test(environmentName)) {
		throw new ConfigFileError(
			"Invalid environment name (only a-zA-Z0-9_- allowed)",
			environmentName || "(empty)",
		);
	}

	const baseFile = findConfigFile(configDir, "default");
	const base = baseFile ? loadConfigFile(baseFile) : {};

	let environment: Record<string, unknown> = {};
	if (environmentName) {
		const envFile = findConfigFile(configDir, environmentName);
		environment = envFile ? loadConfigFile(envFile) : {};
	}

	return { base, environment };
}
