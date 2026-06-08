import { eg } from "@yedoma-labs/bylyt-env-guard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigSecretError } from "../src/errors.js";
import { createConfig } from "../src/index.js";

// Create mock client
let mockClientInstance: { send: ReturnType<typeof vi.fn> };

// Mock AWS SDK
vi.mock("@aws-sdk/client-secrets-manager", () => {
	class MockSecretsManagerClient {
		send: ReturnType<typeof vi.fn>;
		constructor() {
			this.send = mockClientInstance.send;
		}
	}

	class MockGetSecretValueCommand {
		constructor(public params: { SecretId: string }) {}
	}

	return {
		SecretsManagerClient: MockSecretsManagerClient,
		GetSecretValueCommand: MockGetSecretValueCommand,
	};
});

describe("AWS Secrets Manager Integration", () => {
	beforeEach(() => {
		mockClientInstance = {
			send: vi.fn(),
		};
		vi.clearAllMocks();
	});

	describe("Basic Configuration", () => {
		it("loads secrets from AWS Secrets Manager", async () => {
			mockClientInstance.send.mockResolvedValue({
				SecretString: JSON.stringify({
					database_password: "aws-secret-pass",
					api_key: "aws-api-key-123",
				}),
			});

			const config = await createConfig({
				schema: {
					database_password: eg.string().required(),
					api_key: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "aws-secrets-manager",
					aws: {
						region: "us-east-1",
						secretName: "myapp/production/config",
					},
				},
			});

			expect(config.database_password).toBe("aws-secret-pass");
			expect(config.api_key).toBe("aws-api-key-123");
		});

		it("flattens nested AWS secrets", async () => {
			mockClientInstance.send.mockResolvedValue({
				SecretString: JSON.stringify({
					database: {
						host: "aws-db.example.com",
						credentials: {
							username: "admin",
							password: "secret123",
						},
					},
					api: {
						key: "aws-key",
					},
				}),
			});

			const config = await createConfig({
				schema: {
					database_host: eg.string().required(),
					database_credentials_username: eg.string().required(),
					database_credentials_password: eg.string().required(),
					api_key: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "aws-secrets-manager",
					aws: {
						region: "eu-west-1",
						secretName: "app/secrets",
					},
				},
			});

			expect(config.database_host).toBe("aws-db.example.com");
			expect(config.database_credentials_username).toBe("admin");
			expect(config.database_credentials_password).toBe("secret123");
			expect(config.api_key).toBe("aws-key");
		});

		it("handles custom endpoint for LocalStack", async () => {
			mockClientInstance.send.mockResolvedValue({
				SecretString: JSON.stringify({
					test_key: "localstack-value",
				}),
			});

			const config = await createConfig({
				schema: {
					test_key: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "aws-secrets-manager",
					aws: {
						region: "us-east-1",
						secretName: "test/secret",
						endpoint: "http://localhost:4566",
					},
				},
			});

			expect(config.test_key).toBe("localstack-value");
		});
	});

	describe("Error Handling", () => {
		it("throws error if AWS config missing", async () => {
			await expect(
				createConfig({
					schema: {
						key: eg.string().required(),
					},
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "aws-secrets-manager",
					} as never,
				}),
			).rejects.toThrow(/AWS Secrets Manager configuration missing/);
		});

		it("throws error for invalid region", async () => {
			await expect(
				createConfig({
					schema: {
						key: eg.string().required(),
					},
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "aws-secrets-manager",
						aws: {
							region: "invalid-region",
							secretName: "test",
						},
					},
				}),
			).rejects.toThrow(/Invalid AWS region format/);
		});

		it("throws error for invalid secret name", async () => {
			await expect(
				createConfig({
					schema: {
						key: eg.string().required(),
					},
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "aws-secrets-manager",
						aws: {
							region: "us-east-1",
							secretName: "secret;rm -rf /",
						},
					},
				}),
			).rejects.toThrow(/Invalid AWS secret name/);
		});

		it("throws error for secret name too long", async () => {
			const longName = "a".repeat(513);

			await expect(
				createConfig({
					schema: {
						key: eg.string().required(),
					},
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "aws-secrets-manager",
						aws: {
							region: "us-east-1",
							secretName: longName,
						},
					},
				}),
			).rejects.toThrow(/Invalid AWS secret name length/);
		});

		it("throws error for invalid endpoint protocol", async () => {
			await expect(
				createConfig({
					schema: {
						key: eg.string().required(),
					},
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "aws-secrets-manager",
						aws: {
							region: "us-east-1",
							secretName: "test",
							endpoint: "ftp://evil.com",
						},
					},
				}),
			).rejects.toThrow(/Invalid AWS endpoint protocol/);
		});

		it("throws error if secret has no SecretString", async () => {
			mockClientInstance.send.mockResolvedValue({
				SecretBinary: Buffer.from("binary-data"),
			});

			await expect(
				createConfig({
					schema: {
						key: eg.string().required(),
					},
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "aws-secrets-manager",
						aws: {
							region: "us-east-1",
							secretName: "binary-secret",
						},
					},
				}),
			).rejects.toThrow(/has no SecretString value/);
		});

		it("throws error if secret is not valid JSON", async () => {
			mockClientInstance.send.mockResolvedValue({
				SecretString: "not-json",
			});

			await expect(
				createConfig({
					schema: {
						key: eg.string().required(),
					},
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "aws-secrets-manager",
						aws: {
							region: "us-east-1",
							secretName: "invalid-json",
						},
					},
				}),
			).rejects.toThrow(/is not valid JSON/);
		});

		it("throws error if secret is not an object", async () => {
			mockClientInstance.send.mockResolvedValue({
				SecretString: JSON.stringify(["array", "value"]),
			});

			await expect(
				createConfig({
					schema: {
						key: eg.string().required(),
					},
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "aws-secrets-manager",
						aws: {
							region: "us-east-1",
							secretName: "array-secret",
						},
					},
				}),
			).rejects.toThrow(/must be a JSON object, not array/);
		});

		it("sanitizes AWS SDK errors", async () => {
			mockClientInstance.send.mockRejectedValue(
				new Error("AccessDeniedException: User is not authorized to perform this action"),
			);

			await expect(
				createConfig({
					schema: {
						key: eg.string().required(),
					},
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "aws-secrets-manager",
						aws: {
							region: "us-east-1",
							secretName: "unauthorized",
						},
					},
				}),
			).rejects.toThrow(/Failed to load secrets from AWS Secrets Manager/);
		});
	});

	describe("Integration with Config Cascade", () => {
		it("merges AWS secrets with config files", async () => {
			mockClientInstance.send.mockResolvedValue({
				SecretString: JSON.stringify({
					database_password: "aws-secret",
				}),
			});

			const config = await createConfig({
				schema: {
					database_host: eg.string().default("localhost"),
					database_password: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "aws-secrets-manager",
					aws: {
						region: "us-east-1",
						secretName: "app/secrets",
					},
				},
			});

			// From config file
			expect(config.database_host).toBe("test-db");
			// From AWS
			expect(config.database_password).toBe("aws-secret");
		});

		it("AWS secrets override config files", async () => {
			mockClientInstance.send.mockResolvedValue({
				SecretString: JSON.stringify({
					server_port: "9000",
				}),
			});

			const config = await createConfig({
				schema: {
					server_port: eg.port().default(3000),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "aws-secrets-manager",
					aws: {
						region: "eu-central-1",
						secretName: "app/config",
					},
				},
			});

			// AWS should override config file
			expect(config.server_port).toBe(9000);
		});

		it("environment variables override AWS secrets", async () => {
			mockClientInstance.send.mockResolvedValue({
				SecretString: JSON.stringify({
					api_key: "aws-key",
				}),
			});

			process.env.api_key = "env-override";

			const config = await createConfig({
				schema: {
					api_key: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "aws-secrets-manager",
					aws: {
						region: "us-west-1",
						secretName: "test",
					},
				},
			});

			// Environment variable should win
			expect(config.api_key).toBe("env-override");

			delete process.env.api_key;
		});
	});
});
