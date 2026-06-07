import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

/**
 * Minimal working example of turar-config
 * 
 * Run:
 *   npm run dev    - Development mode
 *   npm run prod   - Production mode (requires env vars)
 */

// Define configuration schema
const config = createConfigSync({
  schema: {
    // Server
    server_host: eg.string().default("0.0.0.0"),
    server_port: eg.port().default(3000),
    server_timeout: eg.integer().min(1000).default(30000),

    // Database
    database_host: eg.string().required(),
    database_port: eg.port().default(5432),
    database_name: eg.string().required(),
    database_pool_min: eg.integer().min(1).default(2),
    database_pool_max: eg.integer().min(1).default(10),
    database_ssl: eg.boolean().default(false),

    // Logging
    logging_level: eg.enum(["debug", "info", "warn", "error"] as const).default("info"),
    logging_format: eg.enum(["json", "text"] as const).default("json"),
    logging_colorize: eg.boolean().default(false),

    // Features
    features_enableNewUI: eg.boolean().default(false),
    features_enableAnalytics: eg.boolean().default(true),
  },
  configDir: "./config",
  envFile: true,
  prefix: "APP_",
});

// Display loaded configuration
console.log("═══════════════════════════════════════════════");
console.log("  BASIC APP - Configuration Loaded");
console.log("═══════════════════════════════════════════════");
console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
console.log("");

console.log("🌐 Server Configuration:");
console.log(`  Host:    ${config.server_host}`);
console.log(`  Port:    ${config.server_port}`);
console.log(`  Timeout: ${config.server_timeout}ms`);
console.log("");

console.log("💾 Database Configuration:");
console.log(`  Host: ${config.database_host}`);
console.log(`  Port: ${config.database_port}`);
console.log(`  Name: ${config.database_name}`);
console.log(`  Pool: ${config.database_pool_min}-${config.database_pool_max} connections`);
console.log(`  SSL:  ${config.database_ssl ? "enabled" : "disabled"}`);
console.log("");

console.log("📝 Logging Configuration:");
console.log(`  Level:    ${config.logging_level}`);
console.log(`  Format:   ${config.logging_format}`);
console.log(`  Colorize: ${config.logging_colorize}`);
console.log("");

console.log("🎯 Feature Flags:");
console.log(`  New UI:    ${config.features_enableNewUI ? "ON" : "OFF"}`);
console.log(`  Analytics: ${config.features_enableAnalytics ? "ON" : "OFF"}`);
console.log("");

// Type-safe usage examples
const port: number = config.server_port;
const level: "debug" | "info" | "warn" | "error" = config.logging_level;

console.log("✨ Type Safety Verified:");
console.log(`  Port type: number = ${port}`);
console.log(`  Level type: union = "${level}"`);
console.log("");

console.log("═══════════════════════════════════════════════");
console.log("  Ready to start application!");
console.log("═══════════════════════════════════════════════");

// Export for use in other modules
export { config };
