import type { InferEnv, SchemaDefinition } from "@yedoma-labs/bylyt-env-guard";

export interface VaultAuthToken {
	type: "token";
	token: string;
}

export interface VaultAuthAppRole {
	type: "appRole";
	roleId: string;
	secretId: string;
}

export type VaultAuth = VaultAuthToken | VaultAuthAppRole;

export interface VaultConfig {
	url: string;
	auth: VaultAuth;
	path: string;
	mountPath?: string;
	namespace?: string;
}

export interface AWSSecretsManagerConfig {
	region: string;
	secretName: string;
	// Optional: custom endpoint for LocalStack or other testing
	endpoint?: string;
	// Optional: explicit credentials (use IAM roles in production)
	accessKeyId?: string;
	secretAccessKey?: string;
	// Optional: session token for temporary credentials
	sessionToken?: string;
}

export interface SecretsProviderConfig {
	provider: "env" | "vault" | "aws-secrets-manager";
	// Legacy fields (deprecated, use vault config object)
	vaultUrl?: string;
	vaultToken?: string;
	vaultPath?: string;
	// New structured config
	vault?: VaultConfig;
	aws?: AWSSecretsManagerConfig;
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
