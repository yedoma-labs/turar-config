import type { SchemaDefinition } from "@yedoma-labs/bylyt-env-guard";
import { createEnv } from "@yedoma-labs/bylyt-env-guard";
import { loadConfigFiles } from "./core/file-loader.js";
import { interpolateObject } from "./core/interpolator.js";
import { deepMerge, flattenObject } from "./core/merger.js";
import { loadSecrets } from "./core/secrets-client.js";
import type { ConfigResult, CreateConfigOptions } from "./types.js";

export {
	ConfigError,
	ConfigFileError,
	ConfigInterpolationError,
	ConfigSecretError,
} from "./errors.js";
export type { ConfigResult, CreateConfigOptions, SecretsProviderConfig } from "./types.js";

export async function createConfig<T extends SchemaDefinition>(
	options: CreateConfigOptions<T>,
): Promise<ConfigResult<T>> {
	const {
		schema,
		configDir = "./config",
		envFile = false,
		secrets,
		prefix,
		strict = false,
	} = options;

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

export function createConfigSync<T extends SchemaDefinition>(
	options: CreateConfigOptions<T>,
): ConfigResult<T> {
	const {
		schema,
		configDir = "./config",
		envFile = false,
		secrets,
		prefix,
		strict = false,
	} = options;

	if (secrets && secrets.provider !== "env") {
		throw new Error(
			"Async secrets providers require using createConfig() instead of createConfigSync()",
		);
	}

	const environment = process.env.NODE_ENV;

	const { base, environment: envConfig } = loadConfigFiles(configDir, environment);

	let merged = deepMerge({}, base, envConfig);

	merged = interpolateObject(merged, process.env as Record<string, string | undefined>);

	const flatMerged = flattenObject(merged);

	const sources: (string | Record<string, string | undefined>)[] = [flatMerged];

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
