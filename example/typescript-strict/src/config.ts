import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";
import type { InferEnv } from "@yedoma-labs/bylyt-env-guard";

/**
 * Strongly-typed configuration with full type inference
 */

// Define schema with const assertion for maximum type safety
export const appConfigSchema = {
  // API configuration
  api_baseUrl: eg.url().required(),
  api_timeout: eg.integer().min(1000).max(60000).default(5000),
  api_retries: eg.integer().min(0).max(10).default(3),

  // Database
  database_url: eg.url().required(),

  // Features
  features_enableCache: eg.boolean().default(true),
  features_maxConnections: eg.integer().min(1).default(100),
} as const;

// Infer type from schema - this is the power of turar-config!
export type AppConfig = InferEnv<typeof appConfigSchema>;

/**
 * Load configuration with full type safety
 */
export function getConfig(): AppConfig {
  return createConfigSync({
    schema: appConfigSchema,
    configDir: "./config",
  });
}

/**
 * Example: Type-safe config access helper
 */
export class ConfigService {
  private readonly config: AppConfig;

  constructor() {
    this.config = getConfig();
  }

  // Type-safe getters with specific return types
  getApiBaseUrl(): string {
    return this.config.api_baseUrl;
  }

  getApiTimeout(): number {
    return this.config.api_timeout;
  }

  getDatabaseUrl(): string {
    return this.config.database_url;
  }

  isCacheEnabled(): boolean {
    return this.config.features_enableCache;
  }

  getMaxConnections(): number {
    return this.config.features_maxConnections;
  }

  // Generic getter with type safety
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  // Get entire config (readonly to prevent mutations)
  getAll(): Readonly<AppConfig> {
    return Object.freeze({ ...this.config });
  }
}
