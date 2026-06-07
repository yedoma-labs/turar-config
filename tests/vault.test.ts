import { eg } from "@yedoma-labs/bylyt-env-guard";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigSecretError } from "../src/errors.js";
import { createConfig } from "../src/index.js";

// Mock node-vault
vi.mock("node-vault", () => {
	return {
		default: vi.fn(),
	};
});

describe("HashiCorp Vault Integration", () => {
	let mockVaultClient: {
		token: string | null;
		read: ReturnType<typeof vi.fn>;
		approleLogin: ReturnType<typeof vi.fn>;
	};

	beforeEach(async () => {
		mockVaultClient = {
			token: null,
			read: vi.fn(),
			approleLogin: vi.fn(),
		};

		const vaultModule = await import("node-vault");
		const vaultMock = vaultModule.default as ReturnType<typeof vi.fn>;
		vaultMock.mockReturnValue(mockVaultClient as never);
	});

	describe("Token Authentication", () => {
		it("loads secrets using token auth (new config format)", async () => {
			mockVaultClient.read.mockResolvedValue({
				data: {
					data: {
						database_password: "secret123",
						api_key: "key456",
					},
				},
			});

			const config = await createConfig({
				schema: {
					database_password: eg.string().required(),
					api_key: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: {
							type: "token",
							token: "vault-token-123",
						},
						path: "myapp/config",
					},
				},
			});

			expect(config.database_password).toBe("secret123");
			expect(config.api_key).toBe("key456");
			expect(mockVaultClient.token).toBe("vault-token-123");
			expect(mockVaultClient.read).toHaveBeenCalledWith("secret/data/myapp/config");
		});

		it("loads secrets using token auth (legacy config format)", async () => {
			mockVaultClient.read.mockResolvedValue({
				data: {
					data: {
						database_password: "secret789",
					},
				},
			});

			const config = await createConfig({
				schema: {
					database_password: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vaultUrl: "http://localhost:8200",
					vaultToken: "legacy-token",
					vaultPath: "myapp/secrets",
				},
			});

			expect(config.database_password).toBe("secret789");
			expect(mockVaultClient.token).toBe("legacy-token");
		});

		it("supports custom mount path", async () => {
			mockVaultClient.read.mockResolvedValue({
				data: {
					data: {
						value: "test",
					},
				},
			});

			await createConfig({
				schema: {
					value: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: { type: "token", token: "token" },
						path: "app/config",
						mountPath: "kv",
					},
				},
			});

			expect(mockVaultClient.read).toHaveBeenCalledWith("kv/data/app/config");
		});

		it("supports namespace", async () => {
			mockVaultClient.read.mockResolvedValue({
				data: { data: { value: "test" } },
			});

			await createConfig({
				schema: {
					value: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: { type: "token", token: "token" },
						path: "app/config",
						namespace: "my-namespace",
					},
				},
			});

			const vaultModule = await import("node-vault");
			const vaultMock = vaultModule.default as ReturnType<typeof vi.fn>;

			expect(vaultMock).toHaveBeenCalledWith({
				apiVersion: "v1",
				endpoint: "http://localhost:8200",
				namespace: "my-namespace",
			});
		});
	});

	describe("AppRole Authentication", () => {
		it("authenticates using AppRole", async () => {
			mockVaultClient.approleLogin.mockResolvedValue({
				auth: {
					client_token: "approle-token-xyz",
				},
			});

			mockVaultClient.read.mockResolvedValue({
				data: {
					data: {
						secret: "approle-secret",
					},
				},
			});

			const config = await createConfig({
				schema: {
					secret: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: {
							type: "appRole",
							roleId: "role-123",
							secretId: "secret-456",
						},
						path: "app/secrets",
					},
				},
			});

			expect(mockVaultClient.approleLogin).toHaveBeenCalledWith({
				role_id: "role-123",
				secret_id: "secret-456",
			});
			expect(mockVaultClient.token).toBe("approle-token-xyz");
			expect(config.secret).toBe("approle-secret");
		});
	});

	describe("Nested Secrets", () => {
		it("flattens nested secrets with underscore separator", async () => {
			mockVaultClient.read.mockResolvedValue({
				data: {
					data: {
						database: {
							host: "localhost",
							port: 5432,
							credentials: {
								username: "admin",
								password: "pass123",
							},
						},
					},
				},
			});

			const config = await createConfig({
				schema: {
					database_host: eg.string().required(),
					database_port: eg.port().required(),
					database_credentials_username: eg.string().required(),
					database_credentials_password: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: { type: "token", token: "token" },
						path: "app/config",
					},
				},
			});

			expect(config.database_host).toBe("localhost");
			expect(config.database_port).toBe(5432);
			expect(config.database_credentials_username).toBe("admin");
			expect(config.database_credentials_password).toBe("pass123");
		});

		it("skips null and undefined values", async () => {
			mockVaultClient.read.mockResolvedValue({
				data: {
					data: {
						key1: "value1",
						key2: null,
						key3: undefined,
						key4: "value4",
					},
				},
			});

			const config = await createConfig({
				schema: {
					key1: eg.string().required(),
					key2: eg.string().optional(),
					key3: eg.string().optional(),
					key4: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: { type: "token", token: "token" },
						path: "app/config",
					},
				},
			});

			expect(config.key1).toBe("value1");
			expect(config.key2).toBeUndefined();
			expect(config.key3).toBeUndefined();
			expect(config.key4).toBe("value4");
		});

		it("converts non-string values to strings", async () => {
			mockVaultClient.read.mockResolvedValue({
				data: {
					data: {
						number: 42,
						boolean: true,
						array: [1, 2, 3],
					},
				},
			});

			const config = await createConfig({
				schema: {
					number: eg.integer().required(),
					boolean: eg.boolean().required(),
					array: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: { type: "token", token: "token" },
						path: "app/config",
					},
				},
			});

			expect(config.number).toBe(42);
			expect(config.boolean).toBe(true);
			expect(config.array).toBe("1,2,3");
		});
	});

	describe("Error Handling", () => {
		it("throws error when vault config is missing", async () => {
			await expect(
				createConfig({
					schema: { key: eg.string().required() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
					},
				}),
			).rejects.toThrow(ConfigSecretError);

			await expect(
				createConfig({
					schema: { key: eg.string().required() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
					},
				}),
			).rejects.toThrow("Vault configuration missing");
		});

		it("sanitizes error messages", async () => {
			const longError = new Error("x".repeat(500));
			mockVaultClient.read.mockRejectedValue(longError);

			await expect(
				createConfig({
					schema: { key: eg.string().required() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://localhost:8200",
							auth: { type: "token", token: "token" },
							path: "app/config",
						},
					},
				}),
			).rejects.toThrow(ConfigSecretError);

			try {
				await createConfig({
					schema: { key: eg.string().required() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://localhost:8200",
							auth: { type: "token", token: "token" },
							path: "app/config",
						},
					},
				});
			} catch (error) {
				if (error instanceof ConfigSecretError) {
					// Should be sanitized to 200 chars
					expect(error.message.length).toBeLessThan(300);
				}
			}
		});

		it("throws error on vault connection failure", async () => {
			mockVaultClient.read.mockRejectedValue(new Error("connection refused"));

			await expect(
				createConfig({
					schema: { key: eg.string().required() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://localhost:8200",
							auth: { type: "token", token: "token" },
							path: "app/config",
						},
					},
				}),
			).rejects.toThrow("Failed to load secrets from HashiCorp Vault");
		});

		it("throws error on AppRole login failure", async () => {
			mockVaultClient.approleLogin.mockRejectedValue(new Error("invalid role_id"));

			await expect(
				createConfig({
					schema: { key: eg.string().required() },
					configDir: "./tests/fixtures/config",
					secrets: {
						provider: "vault",
						vault: {
							url: "http://localhost:8200",
							auth: {
								type: "appRole",
								roleId: "invalid",
								secretId: "invalid",
							},
							path: "app/config",
						},
					},
				}),
			).rejects.toThrow(ConfigSecretError);
		});
	});

	describe("Integration with Config Cascade", () => {
		it("merges vault secrets with config files", async () => {
			mockVaultClient.read.mockResolvedValue({
				data: {
					data: {
						database_password: "vault-secret",
					},
				},
			});

			const config = await createConfig({
				schema: {
					server_port: eg.port().default(3000),
					database_host: eg.string().required(),
					database_password: eg.string().required(),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: { type: "token", token: "token" },
						path: "app/secrets",
					},
				},
			});

			// From config file (test.json overrides default.json)
			expect(config.server_port).toBe(3001);
			expect(config.database_host).toBe("test-db");
			// From Vault
			expect(config.database_password).toBe("vault-secret");
		});

		it("vault secrets override config files", async () => {
			mockVaultClient.read.mockResolvedValue({
				data: {
					data: {
						server_port: "9000",
					},
				},
			});

			const config = await createConfig({
				schema: {
					server_port: eg.port().default(3000),
				},
				configDir: "./tests/fixtures/config",
				secrets: {
					provider: "vault",
					vault: {
						url: "http://localhost:8200",
						auth: { type: "token", token: "token" },
						path: "app/secrets",
					},
				},
			});

			// Vault should override config file
			expect(config.server_port).toBe(9000);
		});
	});
});
