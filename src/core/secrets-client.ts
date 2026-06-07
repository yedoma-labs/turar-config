import { ConfigSecretError } from "../errors.js";
import type { SecretsProviderConfig } from "../types.js";

export async function loadSecrets(config: SecretsProviderConfig): Promise<Record<string, string>> {
	if (config.provider === "env") {
		return {};
	}

	if (config.provider === "vault") {
		throw new ConfigSecretError(
			"HashiCorp Vault provider not yet implemented. Use provider: 'env' for now.",
		);
	}

	const sanitizedProvider = String(config.provider).substring(0, 50);
	throw new ConfigSecretError(`Unknown secrets provider: ${sanitizedProvider}`);
}
