import vault from "node-vault";
import { ConfigSecretError } from "../errors.js";
import type { SecretsProviderConfig, VaultConfig } from "../types.js";

const MAX_DEPTH = 100;
const ENV_PROVIDER = "env" as const;
const VAULT_PROVIDER = "vault" as const;

export async function loadSecrets(config: SecretsProviderConfig): Promise<Record<string, string>> {
	if (config.provider === ENV_PROVIDER) {
		return {};
	}

	if (config.provider === VAULT_PROVIDER) {
		return loadVaultSecrets(config);
	}

	const sanitizedProvider = String(config.provider).substring(0, 50);
	throw new ConfigSecretError(`Unknown secrets provider: ${sanitizedProvider}`);
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
		throw new ConfigSecretError(`Maximum nesting depth (${MAX_DEPTH}) exceeded in Vault secrets`);
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
