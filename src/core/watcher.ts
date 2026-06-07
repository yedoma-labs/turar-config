import { resolve } from "node:path";
import type { SchemaDefinition } from "@yedoma-labs/bylyt-env-guard";
import { createEnv } from "@yedoma-labs/bylyt-env-guard";
import { type FSWatcher, watch } from "chokidar";
import type { ConfigResult, SecretsProviderConfig, WatchConfigOptions } from "../types.js";
import { loadConfigFiles } from "./file-loader.js";
import { interpolateObject } from "./interpolator.js";
import { deepMerge, flattenObject } from "./merger.js";
import { loadSecrets } from "./secrets-client.js";

export interface WatchHandle<T extends SchemaDefinition = SchemaDefinition> {
	stop: () => Promise<void>;
	getConfig: () => ConfigResult<T>;
}

export interface ConfigChange {
	type: "added" | "changed" | "removed";
	path: string;
	timestamp: Date;
}

let debounceTimer: NodeJS.Timeout | null = null;

export async function watchConfig<T extends SchemaDefinition>(
	options: WatchConfigOptions<T>,
): Promise<WatchHandle<T>> {
	const {
		schema,
		configDir = "./config",
		envFile = false,
		secrets,
		prefix,
		strict = false,
		onChange,
		debounce = 500,
		ignoreInitial = true,
	} = options;

	let currentConfig: ConfigResult<T>;
	let watcher: FSWatcher | null = null;

	// Load initial config
	currentConfig = await loadConfig(schema, configDir, envFile, secrets, prefix, strict);

	// Set up file watcher
	const resolvedConfigDir = resolve(configDir);
	const watchPatterns = [
		`${resolvedConfigDir}/**/*.json`,
		`${resolvedConfigDir}/**/*.yaml`,
		`${resolvedConfigDir}/**/*.yml`,
		`${resolvedConfigDir}/**/*.toml`,
	];

	watcher = watch(watchPatterns, {
		ignoreInitial,
		persistent: true,
		awaitWriteFinish: {
			stabilityThreshold: 100,
			pollInterval: 50,
		},
	});

	const handleChange = async (changeType: "added" | "changed" | "removed", filePath: string) => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
		}

		debounceTimer = setTimeout(async () => {
			try {
				const newConfig = await loadConfig(schema, configDir, envFile, secrets, prefix, strict);

				const change: ConfigChange = {
					type: changeType,
					path: filePath,
					timestamp: new Date(),
				};

				const oldConfig = currentConfig;
				currentConfig = newConfig;

				if (onChange) {
					onChange(newConfig, change, oldConfig);
				}
			} catch (error) {
				console.error("[turar-config] Error reloading config:", error);
			}
		}, debounce);
	};

	watcher.on("add", (path) => handleChange("added", path));
	watcher.on("change", (path) => handleChange("changed", path));
	watcher.on("unlink", (path) => handleChange("removed", path));

	watcher.on("error", (error) => {
		console.error("[turar-config] Watcher error:", error);
	});

	return {
		stop: async () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}
			if (watcher) {
				await watcher.close();
				watcher = null;
			}
		},
		getConfig: () => currentConfig,
	};
}

async function loadConfig<T extends SchemaDefinition>(
	schema: T,
	configDir: string,
	envFile: boolean | string,
	secrets: SecretsProviderConfig | undefined,
	prefix: string | undefined,
	strict: boolean,
): Promise<ConfigResult<T>> {
	const environment = process.env.NODE_ENV;

	const { base, environment: envConfig } = loadConfigFiles(configDir, environment);

	let merged = deepMerge({}, base, envConfig);

	merged = interpolateObject(merged, process.env as Record<string, string | undefined>);

	const flatMerged = flattenObject(merged);

	const sources: (string | Record<string, string | undefined>)[] = [flatMerged];

	if (secrets) {
		const secretsData = await loadSecrets(secrets);
		sources.push(secretsData);
	}

	if (envFile) {
		const envPath = typeof envFile === "string" ? envFile : ".env";
		sources.push(envPath);
	}

	sources.push(process.env);

	return createEnv({
		schema,
		sources,
		prefix,
		strict,
	});
}
