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

	throw new ConfigSecretError(`Unknown secrets provider: ${config.provider}`);
}
