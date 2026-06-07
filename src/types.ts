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

export interface ConfigChange {
	type: "added" | "changed" | "removed";
	path: string;
	timestamp: Date;
}

export interface WatchConfigOptions<T extends SchemaDefinition> extends CreateConfigOptions<T> {
	onChange?: (newConfig: ConfigResult<T>, change: ConfigChange, oldConfig: ConfigResult<T>) => void;
	debounce?: number;
	ignoreInitial?: boolean;
}
