import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

/**
 * Example: Basic web application configuration
 *
 * Run with:
 *   NODE_ENV=development tsx example/index.ts
 *   NODE_ENV=production DB_HOST=prod.db.example.com tsx example/index.ts
 */

const config = createConfigSync({
	schema: {
		// Server configuration
		server_host: eg.string().default("0.0.0.0"),
		server_port: eg.port().default(3000),
		server_timeout: eg.integer().min(1000).default(30000),

		// Database configuration
		database_host: eg.string().required(),
		database_port: eg.port().default(5432),
		database_name: eg.string().required(),
		database_pool_min: eg.integer().min(1).default(2),
		database_pool_max: eg.integer().min(1).default(10),
		database_ssl: eg.boolean().optional(),

		// Logging
		logging_level: eg.enum(["debug", "info", "warn", "error"] as const).default("info"),
		logging_format: eg.enum(["json", "text"] as const).default("json"),
		logging_colorize: eg.boolean().default(false),

		// Feature flags
		features_enableNewUI: eg.boolean().default(false),
		features_enableBetaFeatures: eg.boolean().default(false),
	},
	configDir: "./example/config",
	envFile: true, // Load .env from current directory
	prefix: "APP_", // Allow APP_ prefixed env vars
});

console.log("📦 Configuration loaded successfully!\n");
console.log("Environment:", process.env.NODE_ENV || "development");
console.log("\n🌐 Server:");
console.log(`  Host: ${config.server_host}`);
console.log(`  Port: ${config.server_port}`);
console.log(`  Timeout: ${config.server_timeout}ms`);

console.log("\n💾 Database:");
console.log(`  Host: ${config.database_host}`);
console.log(`  Port: ${config.database_port}`);
console.log(`  Name: ${config.database_name}`);
console.log(`  Pool: ${config.database_pool_min}-${config.database_pool_max}`);
if (config.database_ssl !== undefined) {
	console.log(`  SSL: ${config.database_ssl}`);
}

console.log("\n📝 Logging:");
console.log(`  Level: ${config.logging_level}`);
console.log(`  Format: ${config.logging_format}`);
console.log(`  Colorize: ${config.logging_colorize}`);

console.log("\n🎯 Features:");
console.log(`  New UI: ${config.features_enableNewUI}`);
console.log(`  Beta Features: ${config.features_enableBetaFeatures}`);

// Type-safe access - TypeScript knows the exact types
const port: number = config.server_port;
const level: "debug" | "info" | "warn" | "error" = config.logging_level;

console.log("\n✨ Type safety verified!");
console.log(`  Port is type: number = ${port}`);
console.log(`  Level is type: "debug" | "info" | "warn" | "error" = "${level}"`);
