import type { InferEnv, SchemaDefinition } from "@yedoma-labs/bylyt-env-guard";

export interface SecretsProviderConfig {
	provider: "env" | "vault";
	vaultUrl?: string;
	vaultToken?: string;
	vaultPath?: string;
}

export interface CreateConfigOptions<T extends SchemaDefinition> {
	schema: T;
	configDir?: string;
	envFile?: boolean | string;
	secrets?: SecretsProviderConfig;
	prefix?: string;
	strict?: boolean;
}

export type ConfigResult<T extends SchemaDefinition> = InferEnv<T>;

export interface LoadedConfigData {
	base: Record<string, unknown>;
	environment: Record<string, unknown>;
	merged: Record<string, unknown>;
}
