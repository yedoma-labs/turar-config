import { ConfigSecretError } from "../errors.js";
import type { AWSSecretsManagerConfig, SecretsProviderConfig, VaultConfig } from "../types.js";

const MAX_DEPTH = 100;
const ENV_PROVIDER = "env" as const;
const VAULT_PROVIDER = "vault" as const;
const AWS_PROVIDER = "aws-secrets-manager" as const;

export async function loadSecrets(config: SecretsProviderConfig): Promise<Record<string, string>> {
	if (config.provider === ENV_PROVIDER) {
		return {};
	}

	if (config.provider === VAULT_PROVIDER) {
		return loadVaultSecrets(config);
	}

	if (config.provider === AWS_PROVIDER) {
		return loadAWSSecrets(config);
	}

	const sanitizedProvider = String(config.provider).substring(0, 50);
	throw new ConfigSecretError(`Unknown secrets provider: ${sanitizedProvider}`);
}

/**
 * Dynamically import node-vault only when needed.
 * Throws clear error if package not installed.
 */
async function importVault() {
	try {
		const vaultModule = await import("node-vault");
		return vaultModule.default;
	} catch (error) {
		throw new ConfigSecretError(
			"HashiCorp Vault integration requires 'node-vault' package. Install it with: npm install node-vault",
			error,
		);
	}
}

/**
 * Dynamically import AWS SDK only when needed.
 * Throws clear error if package not installed.
 */
async function importAWSSecretsManager() {
	try {
		const awsModule = await import("@aws-sdk/client-secrets-manager");
		return {
			SecretsManagerClient: awsModule.SecretsManagerClient,
			GetSecretValueCommand: awsModule.GetSecretValueCommand,
		};
	} catch (error) {
		throw new ConfigSecretError(
			"AWS Secrets Manager integration requires '@aws-sdk/client-secrets-manager' package. Install it with: npm install @aws-sdk/client-secrets-manager",
			error,
		);
	}
}

async function loadVaultSecrets(config: SecretsProviderConfig): Promise<Record<string, string>> {
	// Support both legacy and new config formats
	const vaultConfig = normalizeVaultConfig(config);

	if (!vaultConfig) {
		throw new ConfigSecretError(
			"Vault configuration missing. Provide either 'vault' object or legacy 'vaultUrl', 'vaultToken', 'vaultPath' fields.",
		);
	}

	// Validate Vault URL to prevent SSRF
	validateVaultUrl(vaultConfig.url);

	// Validate Vault path to prevent traversal
	validateVaultPath(vaultConfig.path);

	try {
		// Dynamic import - only loads if user actually uses Vault
		const vault = await importVault();

		const client = vault({
			apiVersion: "v1",
			endpoint: vaultConfig.url,
			namespace: vaultConfig.namespace,
		});

		// Authenticate based on auth type
		if (vaultConfig.auth.type === "token") {
			client.token = vaultConfig.auth.token;
		} else if (vaultConfig.auth.type === "appRole") {
			const loginResponse = await client.approleLogin({
				role_id: vaultConfig.auth.roleId,
				secret_id: vaultConfig.auth.secretId,
			});
			client.token = loginResponse.auth.client_token;
		}

		// Read secrets from KV v2 store
		const mountPath = vaultConfig.mountPath || "secret";
		const fullPath = `${mountPath}/data/${vaultConfig.path}`;

		const response = await client.read(fullPath);

		// KV v2 stores data in response.data.data
		const secrets = response.data?.data || {};

		// Flatten secrets and convert to string key-value pairs
		return flattenSecrets(secrets);
	} catch (error) {
		if (error instanceof ConfigSecretError) {
			throw error;
		}

		// Sanitize error to avoid leaking sensitive info
		// Take only first line and limit length
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		const firstLine = errorMsg.split("\n")[0] || "";
		const sanitizedMsg = firstLine.substring(0, 200);

		throw new ConfigSecretError(
			`Failed to load secrets from HashiCorp Vault: ${sanitizedMsg}`,
			error,
		);
	}
}

async function loadAWSSecrets(config: SecretsProviderConfig): Promise<Record<string, string>> {
	if (!config.aws) {
		throw new ConfigSecretError(
			"AWS Secrets Manager configuration missing. Provide 'aws' object with region and secretName.",
		);
	}

	const awsConfig = config.aws;

	// Validate region
	validateAWSRegion(awsConfig.region);

	// Validate secret name
	validateAWSSecretName(awsConfig.secretName);

	try {
		// Dynamic import - only loads if user actually uses AWS
		const { SecretsManagerClient, GetSecretValueCommand } = await importAWSSecretsManager();

		// Build client configuration
		const clientConfig: {
			region: string;
			endpoint?: string;
			credentials?: {
				accessKeyId: string;
				secretAccessKey: string;
				sessionToken?: string;
			};
		} = {
			region: awsConfig.region,
		};

		// Add custom endpoint if provided (for LocalStack, etc.)
		if (awsConfig.endpoint) {
			validateAWSEndpoint(awsConfig.endpoint);
			clientConfig.endpoint = awsConfig.endpoint;
		}

		// Add explicit credentials if provided (not recommended for production)
		if (awsConfig.accessKeyId && awsConfig.secretAccessKey) {
			clientConfig.credentials = {
				accessKeyId: awsConfig.accessKeyId,
				secretAccessKey: awsConfig.secretAccessKey,
				...(awsConfig.sessionToken && { sessionToken: awsConfig.sessionToken }),
			};
		}

		const client = new SecretsManagerClient(clientConfig);

		const command = new GetSecretValueCommand({
			SecretId: awsConfig.secretName,
		});

		const response = await client.send(command);

		if (!response.SecretString) {
			throw new ConfigSecretError(
				`AWS Secrets Manager secret '${awsConfig.secretName}' has no SecretString value. Binary secrets are not supported.`,
			);
		}

		// Parse JSON secret
		let secrets: Record<string, unknown>;
		try {
			secrets = JSON.parse(response.SecretString);
		} catch (parseError) {
			throw new ConfigSecretError(
				`AWS Secrets Manager secret '${awsConfig.secretName}' is not valid JSON`,
				parseError,
			);
		}

		if (typeof secrets !== "object" || secrets === null || Array.isArray(secrets)) {
			throw new ConfigSecretError(
				`AWS Secrets Manager secret '${awsConfig.secretName}' must be a JSON object, not ${Array.isArray(secrets) ? "array" : typeof secrets}`,
			);
		}

		// Flatten and return
		return flattenSecrets(secrets);
	} catch (error) {
		if (error instanceof ConfigSecretError) {
			throw error;
		}

		// Sanitize AWS SDK errors
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		const firstLine = errorMsg.split("\n")[0] || "";
		const sanitizedMsg = firstLine.substring(0, 200);

		throw new ConfigSecretError(
			`Failed to load secrets from AWS Secrets Manager: ${sanitizedMsg}`,
			error,
		);
	}
}

/**
 * Validate Vault URL to prevent SSRF and malformed URLs
 */
function validateVaultUrl(url: string): void {
	try {
		const parsed = new URL(url);

		// Only allow HTTP/HTTPS
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			throw new ConfigSecretError(
				`Invalid Vault URL protocol: ${parsed.protocol}. Only http: and https: are allowed.`,
			);
		}

		// Validate hostname is not empty
		if (!parsed.hostname) {
			throw new ConfigSecretError("Invalid Vault URL: hostname is required");
		}
	} catch (error) {
		if (error instanceof ConfigSecretError) {
			throw error;
		}
		throw new ConfigSecretError(`Invalid Vault URL: ${url}`, error);
	}
}

/**
 * Validate Vault path to prevent path traversal
 */
function validateVaultPath(path: string): void {
	// Reject paths with ..
	if (path.includes("..")) {
		throw new ConfigSecretError(`Invalid Vault path: contains '..' traversal: ${path}`);
	}

	// Only allow safe characters
	if (!/^[a-zA-Z0-9/_-]+$/.test(path)) {
		throw new ConfigSecretError(
			`Invalid Vault path: contains unsafe characters. Only a-z, A-Z, 0-9, /, _, - are allowed: ${path}`,
		);
	}
}

/**
 * Validate AWS region format
 */
function validateAWSRegion(region: string): void {
	// AWS regions are alphanumeric with dashes: us-east-1, eu-west-2, etc.
	if (!/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
		throw new ConfigSecretError(
			`Invalid AWS region format: ${region}. Expected format: us-east-1, eu-west-2, etc.`,
		);
	}
}

/**
 * Validate AWS secret name
 */
function validateAWSSecretName(secretName: string): void {
	// AWS secret names: alphanumeric, /_+=.@-
	if (!/^[a-zA-Z0-9/_+=.@-]+$/.test(secretName)) {
		throw new ConfigSecretError(
			`Invalid AWS secret name: ${secretName}. Only alphanumeric and /_+=.@- characters allowed.`,
		);
	}

	// Check length (1-512 characters)
	if (secretName.length < 1 || secretName.length > 512) {
		throw new ConfigSecretError(
			`Invalid AWS secret name length: ${secretName.length}. Must be 1-512 characters.`,
		);
	}
}

/**
 * Validate AWS endpoint URL (for custom endpoints like LocalStack)
 */
function validateAWSEndpoint(endpoint: string): void {
	try {
		const parsed = new URL(endpoint);

		// Only allow HTTP/HTTPS
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
			throw new ConfigSecretError(
				`Invalid AWS endpoint protocol: ${parsed.protocol}. Only http: and https: are allowed.`,
			);
		}

		// Validate hostname is not empty
		if (!parsed.hostname) {
			throw new ConfigSecretError("Invalid AWS endpoint: hostname is required");
		}
	} catch (error) {
		if (error instanceof ConfigSecretError) {
			throw error;
		}
		throw new ConfigSecretError(`Invalid AWS endpoint URL: ${endpoint}`, error);
	}
}

function normalizeVaultConfig(config: SecretsProviderConfig): VaultConfig | null {
	// Prefer new structured config
	if (config.vault) {
		return config.vault;
	}

	// Fall back to legacy config
	if (config.vaultUrl && config.vaultToken && config.vaultPath) {
		return {
			url: config.vaultUrl,
			auth: {
				type: "token",
				token: config.vaultToken,
			},
			path: config.vaultPath,
		};
	}

	return null;
}

function flattenSecrets(
	obj: Record<string, unknown>,
	prefix = "",
	depth = 0,
): Record<string, string> {
	// Prevent DoS via deeply nested secrets
	if (depth > MAX_DEPTH) {
		throw new ConfigSecretError(
			`Maximum nesting depth (${MAX_DEPTH}) exceeded in secrets at prefix '${prefix}'`,
		);
	}

	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}_${key}` : key;

		if (value === null || value === undefined) {
			continue;
		}

		if (typeof value === "object" && !Array.isArray(value)) {
			Object.assign(result, flattenSecrets(value as Record<string, unknown>, fullKey, depth + 1));
		} else if (Array.isArray(value)) {
			// Stringify arrays to preserve type information
			result[fullKey] = JSON.stringify(value);
		} else {
			result[fullKey] = String(value);
		}
	}

	return result;
}
