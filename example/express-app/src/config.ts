import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";
import type { InferEnv } from "@yedoma-labs/bylyt-env-guard";

/**
 * Application configuration schema
 */
export const configSchema = {
  // Server
  server_port: eg.port().default(3000),
  server_host: eg.string().default("0.0.0.0"),
  server_trustProxy: eg.boolean().default(false),

  // CORS
  cors_origins: eg.array().separator(",").default(["*"]),
  cors_credentials: eg.boolean().default(true),

  // Database
  database_host: eg.string().required(),
  database_port: eg.port().default(5432),
  database_name: eg.string().required(),
  database_user: eg.string().required(),
  database_password: eg.string().sensitive().optional(),
  database_pool_min: eg.integer().min(1).default(2),
  database_pool_max: eg.integer().min(1).default(10),
  database_ssl: eg.boolean().default(false),

  // Redis
  redis_enabled: eg.boolean().default(false),
  redis_host: eg.string().default("localhost"),
  redis_port: eg.port().default(6379),
  redis_ttl: eg.integer().default(3600),

  // Session
  session_secret: eg.string().sensitive().required(),
  session_name: eg.string().default("sessionId"),
  session_maxAge: eg.integer().default(86400000), // 24 hours

  // Logging
  logging_level: eg.enum(["debug", "info", "warn", "error"] as const).default("info"),
  logging_format: eg.enum(["combined", "common", "dev", "short", "tiny"] as const).default("combined"),

  // Rate limiting
  rateLimit_windowMs: eg.integer().default(900000), // 15 minutes
  rateLimit_max: eg.integer().default(100),
} as const;

export type AppConfig = InferEnv<typeof configSchema>;

/**
 * Load and validate configuration
 */
export function loadConfig(): AppConfig {
  return createConfigSync({
    schema: configSchema,
    configDir: "./config",
    envFile: true,
    prefix: "APP_",
  });
}
