# @yedoma-labs/turar-config

<picture>
  <source media="(max-width: 640px)" srcset="https://raw.githubusercontent.com/yedoma-labs/assets/main/resized/banner-resized-mobile.png">
  <img src="https://raw.githubusercontent.com/yedoma-labs/assets/main/resized/banner-resized.png" alt="Project Header">
</picture>

[![CI](https://github.com/yedoma-labs/turar-config/actions/workflows/ci.yml/badge.svg)](https://github.com/yedoma-labs/turar-config/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@yedoma-labs/turar-config)](https://www.npmjs.com/package/@yedoma-labs/turar-config)
[![npm downloads](https://img.shields.io/npm/dm/@yedoma-labs/turar-config)](https://www.npmjs.com/package/@yedoma-labs/turar-config)
[![Node.js](https://img.shields.io/node/v/@yedoma-labs/turar-config)](https://www.npmjs.com/package/@yedoma-labs/turar-config)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x+-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![License](https://img.shields.io/npm/l/@yedoma-labs/turar-config)](LICENSE)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/@yedoma-labs/turar-config)](https://bundlephobia.com/package/@yedoma-labs/turar-config)

Type-safe configuration management with file loading, environment cascading, and secrets integration. Extends [@yedoma-labs/turar-config](https://github.com/yedoma-labs/turar-config) with advanced config file handling.

## Features

- 📁 **File-based config** - Load JSON configs from `config/` directory
- 🌍 **Environment cascading** - Merge `default.json` → `{NODE_ENV}.json` → env vars
- 🔒 **Secrets integration** - Support for `.env` files and vault providers (Vault support coming soon)
- 🔐 **Type-safe** - Full TypeScript inference from schema
- ✅ **Validation** - Uses bylyt's zero-dependency validation
- 🔗 **Interpolation** - Reference env vars with `${VAR}` syntax in config files
- 🚀 **Zero dependencies** - Only peer depends on turar-config

## Installation

```bash
npm install @yedoma-labs/turar-config @yedoma-labs/turar-config
# or
pnpm add @yedoma-labs/turar-config @yedoma-labs/turar-config
```

## Quick Start

### 1. Create config files

```json
// config/default.json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "pool": {
      "min": 2,
      "max": 10
    }
  },
  "server": {
    "port": 3000
  }
}
```

```json
// config/production.json
{
  "database": {
    "host": "${DB_HOST}",
    "pool": {
      "max": 100
    }
  },
  "server": {
    "port": 8080
  }
}
```

### 2. Define schema and load config

```typescript
import { eg } from "@yedoma-labs/turar-config";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    database_host: eg.string().required(),
    database_port: eg.integer().default(5432),
    database_pool_min: eg.integer().default(2),
    database_pool_max: eg.integer().default(10),
    server_port: eg.port().default(3000),
  },
  configDir: "./config",
  envFile: true, // Load .env file
  prefix: "APP_", // Use APP_ prefix for env vars
});

console.log(config.database_host); // Type-safe access
console.log(config.server_port);   // Type: number
```

## Configuration Cascading

Configuration values are merged with the following priority (highest to lowest):

1. **Environment variables** - `process.env.APP_database_host`
2. **`.env` file** - Values from `.env` (if `envFile: true`)
3. **Environment config** - `config/{NODE_ENV}.json`
4. **Base config** - `config/default.json`
5. **Schema defaults** - `.default()` values in schema

### Example Cascade

```typescript
// config/default.json
{ "server": { "port": 3000, "host": "localhost" } }

// config/production.json
{ "server": { "port": 8080 } }

// process.env.NODE_ENV = "production"
// process.env.APP_server_port = "9000"

// Result:
// {
//   server_port: 9000,     // from env var
//   server_host: "localhost" // from default.json
// }
```

## Variable Interpolation

Reference environment variables in config files using `${VAR}` syntax:

```json
{
  "database": {
    "url": "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}/myapp"
  },
  "api": {
    "key": "${API_KEY}"
  }
}
```

To escape interpolation, use `\${VAR}`:

```json
{
  "example": "This is a literal \\${NOT_INTERPOLATED}"
}
```

## API Reference

### `createConfig(options)`

Async version supporting vault secrets providers (coming soon).

```typescript
const config = await createConfig({
  schema: { /* ... */ },
  configDir: "./config",
  envFile: true,
  secrets: { provider: "env" },
  prefix: "APP_",
  strict: false,
});
```

### `createConfigSync(options)`

Synchronous version for simple use cases.

```typescript
const config = createConfigSync({
  schema: { /* ... */ },
  configDir: "./config",
  envFile: true,
  prefix: "APP_",
  strict: false,
});
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `schema` | `SchemaDefinition` | **required** | Bylyt schema defining config structure |
| `configDir` | `string` | `"./config"` | Directory containing config files |
| `envFile` | `boolean \| string` | `false` | Load `.env` file (or custom path) |
| `secrets` | `SecretsProviderConfig` | `undefined` | Secrets provider config |
| `prefix` | `string` | `undefined` | Prefix for environment variables (e.g., `"APP_"`) |
| `strict` | `boolean` | `false` | Throw on unknown prefixed env vars |

## File Structure

```
your-project/
├── config/
│   ├── default.json      # Base config (always loaded)
│   ├── development.json  # Loaded when NODE_ENV=development
│   ├── test.json         # Loaded when NODE_ENV=test
│   └── production.json   # Loaded when NODE_ENV=production
├── .env                  # Optional environment file
└── src/
    └── config.ts         # Your config setup
```

## Security Considerations

✅ **Safe**:
- JSON files are parsed safely (no eval)
- Environment variables are never logged
- Sensitive values marked with `.sensitive()` are hidden
- Path traversal is prevented (resolved paths)

⚠️ **Important**:
- Never commit `.env` files to version control
- Use `.sensitive()` for secrets in schema
- Interpolation only resolves existing env vars (no code execution)

## Examples

### Basic Web Server

```typescript
import { eg } from "@yedoma-labs/turar-config";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    port: eg.port().default(3000),
    host: eg.string().default("0.0.0.0"),
    database_url: eg.url().required(),
    log_level: eg.enum(["debug", "info", "warn", "error"] as const).default("info"),
  },
  configDir: "./config",
  envFile: true,
});

// Start server with type-safe config
startServer(config.host, config.port);
```

### With Prefix

```typescript
const config = createConfigSync({
  schema: {
    database_host: eg.string(),
    database_port: eg.port(),
  },
  prefix: "MYAPP_",
  envFile: true,
});

// Reads MYAPP_database_host and MYAPP_database_port from env
```

### Deep Nesting

```typescript
// config/default.json
{
  "services": {
    "redis": {
      "cluster": {
        "nodes": ["localhost:6379"]
      }
    }
  }
}

const config = createConfigSync({
  schema: {
    services_redis_cluster_nodes: eg.array().separator(",").default(["localhost:6379"]),
  },
  configDir: "./config",
});
```

## Integration with bylyt-env-guard

`turar-config` is built on top of [@yedoma-labs/bylyt-env-guard](https://github.com/yedoma-labs/bylyt-env-guard) and acts as an **orchestration layer** for configuration management.

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                 turar-config                        │
│  (Orchestration, File Loading, Cascading)          │
│                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │ File Loader  │  │   Merger     │  │Interpolate│ │
│  │   (.json)    │─▶│  (Cascade)   │─▶│   (${})   │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
│         │                  │                │      │
│         └──────────────────┼────────────────┘      │
│                            ▼                        │
│                  ┌──────────────────┐               │
│                  │  bylyt-env-guard │               │
│                  │   (Validation)   │               │
│                  └──────────────────┘               │
└─────────────────────────────────────────────────────┘
```

### Data Flow

1. **Load Files**: `config/default.json` + `config/{NODE_ENV}.json`
2. **Deep Merge**: Cascade configs (base → environment)
3. **Interpolate**: Replace `${VAR}` with env values
4. **Flatten**: Convert nested objects to flat keys (`database_host`)
5. **Validate**: Pass to `bylyt-env-guard` for schema validation
6. **Return**: Type-safe config object

### When to Use What

**Use `bylyt-env-guard` standalone when:**
- Simple environment variable validation
- No config files needed
- Deployment on platforms with env-only config (Heroku, Railway)
- Microservices with minimal configuration

**Use `turar-config` when:**
- Complex nested configuration
- Multiple environments (dev/staging/prod)
- Config files with defaults
- Variable interpolation needed
- Team prefers JSON config over .env files

### Schema Compatibility

`turar-config` uses **the exact same `eg.*` API** as `bylyt-env-guard`:

```typescript
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

// Same schema definition for both
const schema = {
  database_host: eg.string().required(),
  database_port: eg.port().default(5432),
  api_key: eg.string().sensitive().required(),
};

// Use with bylyt directly
import { guardEnv } from "@yedoma-labs/bylyt-env-guard";
const env = guardEnv(schema);

// Or with turar for file support
const config = createConfigSync({ schema, configDir: "./config" });
```

## Advanced Examples

### Multi-Environment Setup

```bash
# File structure
config/
├── default.json       # Base config for all environments
├── development.json   # Local development overrides
├── staging.json       # Staging environment
└── production.json    # Production settings
```

```json
// config/default.json
{
  "database": {
    "pool": { "min": 2, "max": 10 },
    "timeout": 5000,
    "ssl": false
  },
  "cache": {
    "ttl": 300,
    "enabled": true
  },
  "logging": {
    "level": "info"
  }
}

// config/development.json
{
  "database": {
    "host": "localhost",
    "pool": { "max": 5 }
  },
  "logging": {
    "level": "debug"
  }
}

// config/staging.json
{
  "database": {
    "host": "staging-db.internal",
    "pool": { "max": 50 },
    "ssl": true
  }
}

// config/production.json
{
  "database": {
    "host": "${DB_HOST}",
    "pool": { "min": 10, "max": 100 },
    "ssl": true,
    "timeout": 10000
  },
  "cache": {
    "ttl": 3600
  },
  "logging": {
    "level": "warn"
  }
}
```

```typescript
const config = createConfigSync({
  schema: {
    database_host: eg.string().required(),
    database_pool_min: eg.integer(),
    database_pool_max: eg.integer(),
    database_timeout: eg.integer(),
    database_ssl: eg.boolean(),
    cache_ttl: eg.integer(),
    cache_enabled: eg.boolean(),
    logging_level: eg.enum(["debug", "info", "warn", "error"] as const),
  },
  configDir: "./config",
});

// Development: logging_level = "debug", database_pool_max = 5
// Production: logging_level = "warn", database_pool_max = 100
```

### Using with TypeScript Strict Mode

```typescript
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";
import type { InferEnv } from "@yedoma-labs/bylyt-env-guard";

// Define schema separately for reuse
const configSchema = {
  server_port: eg.port().default(3000),
  database_url: eg.url().required(),
  redis_enabled: eg.boolean().default(false),
  log_level: eg.enum(["debug", "info", "warn", "error"] as const).default("info"),
} as const;

// Infer type from schema
type AppConfig = InferEnv<typeof configSchema>;

// Load config
const config: AppConfig = createConfigSync({
  schema: configSchema,
  configDir: "./config",
});

// TypeScript knows exact types
const port: number = config.server_port; // ✓
const url: string = config.database_url;  // ✓
const level: "debug" | "info" | "warn" | "error" = config.log_level; // ✓

// Type errors
// const invalid: string = config.server_port; // ✗ Type 'number' is not assignable to type 'string'
// const unknown = config.nonexistent;         // ✗ Property 'nonexistent' does not exist
```

### Nested Object Configs with Deep Merging

```json
// config/default.json
{
  "services": {
    "api": {
      "endpoints": {
        "users": "/api/v1/users",
        "posts": "/api/v1/posts"
      },
      "timeout": 5000,
      "retry": {
        "attempts": 3,
        "backoff": 1000
      }
    },
    "cache": {
      "redis": {
        "cluster": {
          "nodes": ["localhost:6379"],
          "options": {
            "maxRedirections": 16
          }
        }
      }
    }
  }
}

// config/production.json
{
  "services": {
    "api": {
      "endpoints": {
        "users": "/api/v2/users"  // Override only 'users' endpoint
      },
      "retry": {
        "attempts": 5              // Override only 'attempts'
      }
    },
    "cache": {
      "redis": {
        "cluster": {
          "nodes": ["redis-1:6379", "redis-2:6379", "redis-3:6379"]
        }
      }
    }
  }
}
```

```typescript
const config = createConfigSync({
  schema: {
    services_api_endpoints_users: eg.string(),
    services_api_endpoints_posts: eg.string(),
    services_api_timeout: eg.integer(),
    services_api_retry_attempts: eg.integer(),
    services_api_retry_backoff: eg.integer(),
    services_cache_redis_cluster_nodes: eg.array().separator(","),
    services_cache_redis_cluster_options_maxRedirections: eg.integer(),
  },
  configDir: "./config",
});

// Production result:
// services_api_endpoints_users: "/api/v2/users"  (from production.json)
// services_api_endpoints_posts: "/api/v1/posts"  (from default.json)
// services_api_retry_attempts: 5                  (from production.json)
// services_api_retry_backoff: 1000                (from default.json)
```

### Array Handling in Config Files

```json
// Arrays are REPLACED, not merged
{
  "allowed_origins": ["http://localhost:3000", "http://localhost:3001"],
  "features": ["auth", "search", "upload"]
}
```

```typescript
const config = createConfigSync({
  schema: {
    // Arrays as comma-separated strings
    allowed_origins: eg.array().separator(",").default(["*"]),
    
    // Arrays as JSON strings
    features: eg.json().default([]),
  },
  configDir: "./config",
});

// Environment variable override:
// ALLOWED_ORIGINS="https://app.com,https://admin.app.com"
```

### Error Handling Patterns

```typescript
import {
  ConfigFileError,
  ConfigInterpolationError,
  ConfigSecretError,
} from "@yedoma-labs/turar-config";
import { EnvValidationError } from "@yedoma-labs/bylyt-env-guard";

try {
  const config = createConfigSync({
    schema: {
      required_field: eg.string().required(),
    },
    configDir: "./config",
  });
} catch (error) {
  if (error instanceof ConfigFileError) {
    console.error("Config file error:");
    console.error("  Path:", error.path);
    console.error("  Message:", error.message);
    process.exit(1);
  }
  
  if (error instanceof ConfigInterpolationError) {
    console.error("Interpolation error:");
    console.error("  Undefined variable:", error.variable);
    console.error("  Hint: Set environment variable", error.variable);
    process.exit(1);
  }
  
  if (error instanceof EnvValidationError) {
    console.error("Validation failed:");
    for (const failure of error.failures) {
      console.error(`  ${failure.key}: ${failure.message}`);
    }
    process.exit(1);
  }
  
  // Unknown error
  console.error("Unexpected error:", error);
  process.exit(1);
}
```

### Integration with Popular Frameworks

#### Express

```typescript
import express from "express";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    server_port: eg.port().default(3000),
    server_host: eg.string().default("0.0.0.0"),
    database_url: eg.url().required(),
    session_secret: eg.string().sensitive().required(),
    cors_origins: eg.array().separator(",").default(["*"]),
  },
  configDir: "./config",
  envFile: true,
});

const app = express();

// Use config throughout app
app.use(cors({ origin: config.cors_origins }));
app.use(session({ secret: config.session_secret }));

app.listen(config.server_port, config.server_host, () => {
  console.log(`Server running on ${config.server_host}:${config.server_port}`);
});
```

#### Fastify

```typescript
import Fastify from "fastify";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    server_port: eg.port().default(3000),
    server_logger: eg.boolean().default(true),
    database_url: eg.url().required(),
  },
  configDir: "./config",
});

const fastify = Fastify({
  logger: config.server_logger,
});

fastify.register(require("@fastify/postgres"), {
  connectionString: config.database_url,
});

fastify.listen({
  port: config.server_port,
});
```

#### NestJS

```typescript
// config/configuration.ts
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

export const configSchema = {
  server_port: eg.port().default(3000),
  database_host: eg.string().required(),
  database_port: eg.port().default(5432),
  redis_url: eg.url().required(),
} as const;

export const loadConfiguration = () => createConfigSync({
  schema: configSchema,
  configDir: "./config",
  envFile: true,
});

export type AppConfig = ReturnType<typeof loadConfiguration>;

// app.module.ts
import { Module } from "@nestjs/common";
import { loadConfiguration } from "./config/configuration";

const config = loadConfiguration();

@Module({
  providers: [
    {
      provide: "CONFIG",
      useValue: config,
    },
  ],
  exports: ["CONFIG"],
})
export class ConfigModule {}

// Using in a service
import { Injectable, Inject } from "@nestjs/common";
import type { AppConfig } from "./config/configuration";

@Injectable()
export class AppService {
  constructor(@Inject("CONFIG") private config: AppConfig) {}

  getPort(): number {
    return this.config.server_port;
  }
}
```

## Configuration Best Practices

### File Structure Recommendations

```bash
# Recommended structure
project/
├── config/
│   ├── default.json          # Base config (committed)
│   ├── development.json      # Dev overrides (committed)
│   ├── test.json             # Test config (committed)
│   ├── staging.json          # Staging config (committed)
│   ├── production.json       # Prod settings (committed, no secrets)
│   └── local.json            # Personal overrides (gitignored)
├── .env                      # Secrets (gitignored)
├── .env.example              # Template (committed)
└── src/
    └── config/
        └── index.ts          # Config setup (committed)
```

### Security Guidelines

**✅ Safe to commit:**
- `config/*.json` files with **no secrets**
- `.env.example` with placeholder values
- Default ports, timeouts, feature flags
- Non-sensitive URLs (e.g., public APIs)

**⛔ Never commit:**
- `.env` files
- API keys, passwords, tokens
- Database credentials
- Private keys, certificates
- Production secrets

**Use `.sensitive()` for secrets:**
```typescript
const config = createConfigSync({
  schema: {
    api_key: eg.string().sensitive().required(),      // Hidden in logs
    database_password: eg.string().sensitive().required(),
    jwt_secret: eg.string().sensitive().required(),
  },
  configDir: "./config",
});
```

**`.gitignore` template:**
```gitignore
# Environment files
.env
.env.local
.env.*.local

# Local config overrides
config/local.json
config/*.local.json

# Secrets
secrets/
*.key
*.pem
```

### Performance Tips

**1. Use `createConfigSync()` for startup:**
```typescript
// At app startup - blocking is fine
const config = createConfigSync({ schema, configDir: "./config" });
```

**2. Cache config object:**
```typescript
// config.ts
let cachedConfig: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!cachedConfig) {
    cachedConfig = createConfigSync({ schema, configDir: "./config" });
  }
  return cachedConfig;
}
```

**3. Avoid deep nesting when possible:**
```typescript
// Instead of:
services_api_endpoints_v1_users_list_pagination_limit

// Prefer:
api_users_page_size
```

**4. Use JSON over YAML (when available):**
- JSON parsing is faster
- Native browser/Node.js support
- Smaller bundle size

### Migration from dotenv/config/rc

#### From `dotenv`

**Before (dotenv):**
```javascript
// .env
DATABASE_HOST=localhost
DATABASE_PORT=5432

// app.js
require('dotenv').config();
const host = process.env.DATABASE_HOST;
const port = parseInt(process.env.DATABASE_PORT || '5432');
```

**After (turar-config):**
```typescript
// config/default.json
{ "database": { "host": "localhost", "port": 5432 } }

// app.ts
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    database_host: eg.string().required(),
    database_port: eg.port().default(5432),
  },
  configDir: "./config",
  envFile: true, // Still loads .env
});

const host = config.database_host; // Type-safe
const port = config.database_port; // number
```

#### From `config` (node-config)

**Before (node-config):**
```javascript
const config = require('config');
const dbConfig = config.get('database');
const host = dbConfig.host; // Runtime check
```

**After (turar-config):**
```typescript
const config = createConfigSync({
  schema: {
    database_host: eg.string().required(),
    database_port: eg.port(),
  },
  configDir: "./config",
});

const host = config.database_host; // Compile-time type safety
```

#### From `rc`

**Before (rc):**
```javascript
const conf = require('rc')('myapp', {
  port: 8000,
  host: 'localhost'
});
```

**After (turar-config):**
```typescript
const config = createConfigSync({
  schema: {
    port: eg.port().default(8000),
    host: eg.string().default("localhost"),
  },
  configDir: "./config",
  prefix: "myapp_",
});
```

## Troubleshooting

### Common Errors and Fixes

#### Error: "Config file not found"

```
ConfigFileError: Config file not found: ./config/default.json
```

**Fix:**
- Ensure `config/default.json` exists
- Check `configDir` option points to correct directory
- Use absolute path if needed: `path.join(__dirname, 'config')`

#### Error: "Undefined variable"

```
ConfigInterpolationError: Undefined environment variable: DB_PASSWORD
```

**Fix:**
- Set the environment variable: `export DB_PASSWORD=secret`
- Or add to `.env` file: `DB_PASSWORD=secret`
- Check variable name matches exactly (case-sensitive)

#### Error: "Validation failed"

```
EnvValidationError: Environment validation failed
  database_host: Required value missing
```

**Fix:**
- Ensure required fields are in config files or env vars
- Check nested object keys are flattened correctly
- Verify env var naming: `database_host` → `DATABASE_HOST` or `APP_database_host`

#### Error: "Invalid JSON"

```
ConfigFileError: Failed to parse JSON: Unexpected token } in JSON at position 42
```

**Fix:**
- Validate JSON syntax using a linter or `node -e "require('./config/default.json')"`
- Common issues: trailing commas, single quotes, missing quotes on keys

### Debugging Config Loading

**Enable debug logging:**

```typescript
import { createConfigSync } from "@yedoma-labs/turar-config";

// Set NODE_ENV to see which file is loaded
console.log("Loading config for environment:", process.env.NODE_ENV);

const config = createConfigSync({
  schema: { /* ... */ },
  configDir: "./config",
});

console.log("Config loaded:", JSON.stringify(config, null, 2));
```

**Inspect loaded files:**

```typescript
import { loadConfigFiles } from "@yedoma-labs/turar-config/core/file-loader";

const loaded = loadConfigFiles("./config");
console.log("Base config:", loaded.base);
console.log("Environment config:", loaded.environment);
console.log("Merged config:", loaded.merged);
```

### Environment Variable Naming Conventions

**Flat keys:**
```typescript
// Schema key → Env var
database_host     → DATABASE_HOST
server_port       → SERVER_PORT
api_key           → API_KEY
```

**With prefix:**
```typescript
// prefix: "APP_"
database_host     → APP_database_host  (exact case)
server_port       → APP_server_port
```

**Nested objects:**
```json
// config/default.json
{ "database": { "pool": { "max": 10 } } }

// Schema
{ database_pool_max: eg.integer() }

// Env var
DATABASE_POOL_MAX=20
```

## API Reference

### `createConfig(options)`

Asynchronous configuration loader (for future secrets providers).

```typescript
function createConfig<T extends SchemaDefinition>(
  options: CreateConfigOptions<T>
): Promise<ConfigResult<T>>
```

**Parameters:**
- `options.schema` **(required)**: Schema definition using `eg.*` API
- `options.configDir` (optional): Directory containing config files (default: `"./config"`)
- `options.envFile` (optional): Load `.env` file - `true` or custom path (default: `false`)
- `options.secrets` (optional): Secrets provider configuration
- `options.prefix` (optional): Prefix for environment variables (e.g., `"APP_"`)
- `options.strict` (optional): Throw on unknown prefixed env vars (default: `false`)

**Returns:** `Promise<ConfigResult<T>>` - Type-safe configuration object

**Throws:**
- `ConfigFileError` - File not found or invalid JSON
- `ConfigInterpolationError` - Undefined variable in `${VAR}`
- `EnvValidationError` - Schema validation failed

**Example:**
```typescript
const config = await createConfig({
  schema: {
    database_url: eg.url().required(),
  },
  configDir: "./config",
  envFile: true,
});
```

### `createConfigSync(options)`

Synchronous configuration loader.

```typescript
function createConfigSync<T extends SchemaDefinition>(
  options: CreateConfigOptions<T>
): ConfigResult<T>
```

**Parameters:** Same as `createConfig()`

**Returns:** `ConfigResult<T>` - Type-safe configuration object

**Throws:** Same as `createConfig()`

**Example:**
```typescript
const config = createConfigSync({
  schema: {
    server_port: eg.port().default(3000),
  },
  configDir: "./config",
});
```

### Error Types

#### `ConfigError`

Base class for all turar-config errors.

```typescript
class ConfigError extends Error {
  name: "ConfigError";
}
```

#### `ConfigFileError`

Thrown when config file cannot be loaded or parsed.

```typescript
class ConfigFileError extends ConfigError {
  name: "ConfigFileError";
  path: string;        // Path to the problematic file
  cause?: unknown;     // Original error (e.g., SyntaxError)
}
```

**Example:**
```typescript
try {
  const config = createConfigSync({ schema, configDir: "./config" });
} catch (error) {
  if (error instanceof ConfigFileError) {
    console.error(`Failed to load ${error.path}:`, error.message);
    if (error.cause) {
      console.error("Caused by:", error.cause);
    }
  }
}
```

#### `ConfigInterpolationError`

Thrown when interpolation references undefined variable.

```typescript
class ConfigInterpolationError extends ConfigError {
  name: "ConfigInterpolationError";
  variable: string;    // Name of undefined variable
}
```

**Example:**
```typescript
// config/production.json: { "api": { "key": "${API_KEY}" } }
// But API_KEY is not set

try {
  const config = createConfigSync({ schema, configDir: "./config" });
} catch (error) {
  if (error instanceof ConfigInterpolationError) {
    console.error(`Please set ${error.variable}:`);
    console.error(`  export ${error.variable}=your-value`);
  }
}
```

#### `ConfigSecretError`

Thrown when secrets provider fails.

```typescript
class ConfigSecretError extends ConfigError {
  name: "ConfigSecretError";
}
```

### Types

#### `ConfigResult<T>`

Inferred configuration type from schema.

```typescript
type ConfigResult<T extends SchemaDefinition> = InferEnv<T>;
```

**Example:**
```typescript
const schema = {
  port: eg.port().default(3000),
  host: eg.string().required(),
} as const;

type Config = ConfigResult<typeof schema>;
// Equivalent to:
// {
//   port: number;
//   host: string;
// }
```

#### `CreateConfigOptions<T>`

Configuration options for `createConfig()` and `createConfigSync()`.

```typescript
interface CreateConfigOptions<T extends SchemaDefinition> {
  schema: T;
  configDir?: string;
  envFile?: boolean | string;
  secrets?: SecretsProviderConfig;
  prefix?: string;
  strict?: boolean;
}
```

#### `SecretsProviderConfig`

Secrets provider configuration (Vault support coming soon).

```typescript
interface SecretsProviderConfig {
  provider: "env" | "vault";
  vaultUrl?: string;
  vaultToken?: string;
  vaultPath?: string;
}
```

## Error Handling

## Roadmap

- [ ] HashiCorp Vault integration
- [ ] AWS Secrets Manager support
- [ ] YAML config file support
- [ ] TOML config file support
- [ ] Config file watching / hot reload
- [ ] Config migration helpers
- [ ] Config diffing / auditing tools
- [ ] VS Code extension for config validation

## Contributing

Contributions welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## Support

- 📖 [Documentation](https://github.com/yedoma-labs/turar-config#readme)
- 🐛 [Issue Tracker](https://github.com/yedoma-labs/turar-config/issues)
- 💬 [Discussions](https://github.com/yedoma-labs/turar-config/discussions)

## License

MIT

## Related Projects

- [@yedoma-labs/turar-config](https://github.com/yedoma-labs/turar-config) - Zero-dependency env validation
