import { getConfig, ConfigService } from "./config.js";

/**
 * TypeScript Strict Mode Example
 * 
 * Demonstrates full type safety with turar-config
 */

console.log("═══════════════════════════════════════════════");
console.log("  TypeScript Strict Mode Example");
console.log("═══════════════════════════════════════════════\n");

// Method 1: Direct config access
console.log("Method 1: Direct Config Access");
const config = getConfig();

// TypeScript knows exact types - no type assertions needed!
const apiUrl: string = config.api_baseUrl;
const timeout: number = config.api_timeout;
const cacheEnabled: boolean = config.features_enableCache;

console.log(`  API URL: ${apiUrl}`);
console.log(`  Timeout: ${timeout}ms`);
console.log(`  Cache: ${cacheEnabled ? "enabled" : "disabled"}\n`);

// Method 2: Using ConfigService
console.log("Method 2: Using ConfigService");
const service = new ConfigService();

console.log(`  Database URL: ${service.getDatabaseUrl()}`);
console.log(`  Max Connections: ${service.getMaxConnections()}`);
console.log(`  Retries: ${service.get("api_retries")}\n`);

// Type-safe operations
console.log("Type-Safe Operations:");

// Numbers can be used in arithmetic
const totalTimeout = config.api_timeout * config.api_retries;
console.log(`  Total max timeout: ${totalTimeout}ms`);

// Booleans in conditionals
if (config.features_enableCache) {
  console.log(`  Cache is enabled for ${config.features_maxConnections} connections`);
}

// Strings can be manipulated
const hostname = new URL(config.api_baseUrl).hostname;
console.log(`  API hostname: ${hostname}\n`);

// Advanced: Type-safe configuration validator
console.log("Advanced: Type-Safe Validation");

function validateTimeout(timeout: number): boolean {
  return timeout >= 1000 && timeout <= 60000;
}

function validateConnections(max: number): boolean {
  return max > 0 && max <= 1000;
}

const timeoutValid = validateTimeout(config.api_timeout);
const connectionsValid = validateConnections(config.features_maxConnections);

console.log(`  Timeout valid: ${timeoutValid}`);
console.log(`  Connections valid: ${connectionsValid}\n`);

console.log("═══════════════════════════════════════════════");
console.log("  Type Safety Verified! ✨");
console.log("═══════════════════════════════════════════════");
console.log("\nKey Benefits:");
console.log("  • No type assertions needed");
console.log("  • Autocomplete for all config keys");
console.log("  • Compile-time error on typos");
console.log("  • Correct types for all values");
console.log("  • Refactoring safety");
console.log("\nTry editing src/config.ts and see how TypeScript");
console.log("catches errors immediately!");
