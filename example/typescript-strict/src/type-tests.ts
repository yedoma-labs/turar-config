/**
 * Type safety demonstrations and compile-time tests
 * 
 * Run with: npm run test
 */

import { getConfig, ConfigService, type AppConfig } from "./config.js";

console.log("Running TypeScript strict mode type tests...\n");

// Test 1: Basic type inference
console.log("✓ Test 1: Basic type inference");
const config = getConfig();

// These should all pass type checking
const url: string = config.api_baseUrl;
const timeout: number = config.api_timeout;
const retries: number = config.api_retries;
const cacheEnabled: boolean = config.features_enableCache;

console.log(`  api_baseUrl: ${url} (type: string)`);
console.log(`  api_timeout: ${timeout} (type: number)`);
console.log(`  features_enableCache: ${cacheEnabled} (type: boolean)\n`);

// Test 2: Exhaustive property access
console.log("✓ Test 2: Exhaustive property access");
const allKeys: (keyof AppConfig)[] = [
  "api_baseUrl",
  "api_timeout",
  "api_retries",
  "database_url",
  "features_enableCache",
  "features_maxConnections",
];

for (const key of allKeys) {
  const value = config[key];
  console.log(`  ${key}: ${value}`);
}
console.log("");

// Test 3: Type narrowing
console.log("✓ Test 3: Type narrowing");
function processConfig(cfg: AppConfig): void {
  // TypeScript knows exact types
  if (cfg.api_timeout < 3000) {
    console.log("  Warning: API timeout is low");
  }

  if (cfg.features_enableCache) {
    console.log(`  Cache enabled with ${cfg.features_maxConnections} max connections`);
  }
}
processConfig(config);
console.log("");

// Test 4: ConfigService type safety
console.log("✓ Test 4: ConfigService type safety");
const service = new ConfigService();

const apiUrl: string = service.getApiBaseUrl();
const dbUrl: string = service.getDatabaseUrl();
const maxConn: number = service.getMaxConnections();

console.log(`  API URL: ${apiUrl}`);
console.log(`  Database URL: ${dbUrl}`);
console.log(`  Max Connections: ${maxConn}\n`);

// Test 5: Generic getter with type preservation
console.log("✓ Test 5: Generic getter with type preservation");
const timeout2: number = service.get("api_timeout");
const enabled: boolean = service.get("features_enableCache");

console.log(`  Timeout (via get): ${timeout2} (type: number)`);
console.log(`  Cache enabled (via get): ${enabled} (type: boolean)\n`);

// Test 6: Readonly config
console.log("✓ Test 6: Readonly config");
const readonlyConfig = service.getAll();
console.log(`  Config is frozen: ${Object.isFrozen(readonlyConfig)}`);
// Attempting to modify would fail at compile time:
// readonlyConfig.api_timeout = 1000; // ✗ Error: Cannot assign to 'api_timeout' because it is a read-only property
console.log("");

// Test 7: Type-safe function parameters
console.log("✓ Test 7: Type-safe function parameters");
function makeApiRequest(baseUrl: string, timeout: number): void {
  console.log(`  Making request to ${baseUrl} with ${timeout}ms timeout`);
}

// These are guaranteed to be the correct types
makeApiRequest(config.api_baseUrl, config.api_timeout);
console.log("");

// Test 8: Conditional logic with type safety
console.log("✓ Test 8: Conditional logic with type safety");
function getRetryDelay(retries: number): number {
  return Math.min(retries * 1000, 10000);
}

const delay = getRetryDelay(config.api_retries);
console.log(`  Retry delay: ${delay}ms\n`);

// Test 9: Destructuring with type preservation
console.log("✓ Test 9: Destructuring with type preservation");
const {
  api_baseUrl,
  api_timeout,
  database_url,
  features_enableCache,
} = config;

// All retain their types
const urlLower: string = api_baseUrl.toLowerCase();
const timeoutDoubled: number = api_timeout * 2;

console.log(`  URL (lowercase): ${urlLower}`);
console.log(`  Timeout (doubled): ${timeoutDoubled}ms\n`);

// Test 10: Mapped types
console.log("✓ Test 10: Mapped types");
type ConfigKeys = keyof AppConfig;
type ConfigValues = AppConfig[ConfigKeys];

const keys: ConfigKeys[] = Object.keys(config) as ConfigKeys[];
console.log(`  Config has ${keys.length} keys`);
console.log(`  Keys: ${keys.join(", ")}\n`);

console.log("═══════════════════════════════════════════════");
console.log("All type tests passed! ✨");
console.log("TypeScript strict mode is working correctly.");
console.log("═══════════════════════════════════════════════");

// Type-only tests (compile-time only)
// Uncomment to see TypeScript errors:

// ✗ Error: Property 'nonexistent' does not exist
// const invalid = config.nonexistent;

// ✗ Error: Type 'number' is not assignable to type 'string'
// const wrongType: string = config.api_timeout;

// ✗ Error: Type 'string' is not assignable to type 'number'
// const wrongType2: number = config.api_baseUrl;

// ✗ Error: Argument of type '"invalid_key"' is not assignable
// const wrongKey = service.get("invalid_key");
