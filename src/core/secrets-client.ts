import vault from "node-vault";
import { ConfigSecretError } from "../errors.js";
import type { SecretsProviderConfig, VaultConfig } from "../types.js";

export async function loadSecrets(config: SecretsProviderConfig): Promise<Record<string, string>> {
	if (config.provider === "env") {
		return {};
	}

	if (config.provider === "vault") {
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
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		const sanitizedMsg = errorMsg.substring(0, 200);

		throw new ConfigSecretError(
			`Failed to load secrets from HashiCorp Vault: ${sanitizedMsg}`,
			error,
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

function flattenSecrets(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
	const result: Record<string, string> = {};

	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}_${key}` : key;

		if (value === null || value === undefined) {
			continue;
		}

		if (typeof value === "object" && !Array.isArray(value)) {
			Object.assign(result, flattenSecrets(value as Record<string, unknown>, fullKey));
		} else {
			result[fullKey] = String(value);
		}
	}

	return result;
}
