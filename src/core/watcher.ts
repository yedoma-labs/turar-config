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
	let debounceTimer: NodeJS.Timeout | null = null;
	let stopped = false;
	let errorHandler: ((error: Error) => void) | null = null;

	// Load initial config with error handling
	try {
		currentConfig = await loadConfig(schema, configDir, envFile, secrets, prefix, strict);
	} catch (error) {
		// If initial load fails, re-throw (watcher not created yet, no cleanup needed)
		throw error;
	}

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

	/**
	 * Handle file change events with debouncing.
	 * Debouncing prevents excessive reloads during rapid file changes.
	 * The stopped flag ensures no callbacks fire after stop() is called.
	 */
	const handleChange = async (changeType: "added" | "changed" | "removed", filePath: string) => {
		if (debounceTimer) {
			clearTimeout(debounceTimer);
			debounceTimer = null;
		}

		debounceTimer = setTimeout(async () => {
			// Check if watcher was stopped before processing
			if (stopped) {
				return;
			}

			try {
				const newConfig = await loadConfig(schema, configDir, envFile, secrets, prefix, strict);

				const change: ConfigChange = {
					type: changeType,
					path: filePath,
					timestamp: new Date(),
				};

				const oldConfig = currentConfig;

				// Always update currentConfig on successful reload
				currentConfig = newConfig;

				// Call onChange callback if provided (errors don't rollback config)
				if (onChange) {
					try {
						onChange(newConfig, change, oldConfig);
					} catch (callbackError) {
						console.error("[turar-config] Error in onChange callback:", callbackError);
					}
				}
			} catch (error) {
				console.error("[turar-config] Error reloading config:", error);
			}
		}, debounce);
	};

	watcher.on("add", (path) => handleChange("added", path));
	watcher.on("change", (path) => handleChange("changed", path));
	watcher.on("unlink", (path) => handleChange("removed", path));

	errorHandler = (error: Error) => {
		console.error("[turar-config] Watcher error:", error);
	};
	watcher.on("error", errorHandler);

	return {
		stop: async () => {
			// Set stopped flag first to prevent any pending callbacks
			stopped = true;

			// Clear any pending debounce timer
			if (debounceTimer) {
				clearTimeout(debounceTimer);
				debounceTimer = null;
			}

			// Remove error handler and close watcher
			if (watcher) {
				if (errorHandler) {
					watcher.off("error", errorHandler);
					errorHandler = null;
				}
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
