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
npm install @yedoma-labs/bylyt-env-guard @yedoma-labs/turar-config
# or
pnpm add @yedoma-labs/bylyt-env-guard @yedoma-labs/turar-config
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

## Error Handling

```typescript
try {
  const config = createConfigSync({
    schema: {
      required_field: eg.string().required(),
    },
    configDir: "./config",
  });
} catch (error) {
  if (error instanceof ConfigFileError) {
    console.error("Failed to load config file:", error.path);
  }
  if (error instanceof ConfigInterpolationError) {
    console.error("Undefined variable:", error.variable);
  }
  if (error instanceof EnvValidationError) {
    console.error("Validation failed:", error.failures);
  }
}
```

## Integration with bylyt-env-guard

turar-config is an **orchestration layer** built on top of bylyt-env-guard. Here's how they work together:

### Architecture

```
┌─────────────────────────────────────────┐
│         Your Application                │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│     turar-config (this package)         │
│  • Load JSON files                      │
│  • Merge configs                        │
│  • Interpolate ${VAR}                   │
│  • Flatten objects                      │
└────────────────┬────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────┐
│     bylyt-env-guard (peer dep)          │
│  • Validate types                       │
│  • Type coercion                        │
│  • Type inference                       │
│  • Freeze result                        │
└─────────────────────────────────────────┘
```

### Responsibilities

| Feature | Handled By | Description |
|---------|-----------|-------------|
| File Loading | turar-config | Load `config/*.json` files |
| Cascading | turar-config | Merge configs by environment |
| Interpolation | turar-config | Resolve `${VAR}` in JSON |
| Flattening | turar-config | `{db: {host}}` → `{db_host}` |
| **Validation** | bylyt-env-guard | Type checking, constraints |
| **Type Safety** | bylyt-env-guard | TypeScript inference |
| **Freezing** | bylyt-env-guard | Immutable config object |

### When to Use What?

**Use bylyt-env-guard alone** if:
- ✅ You only need environment variables
- ✅ Simple .env file is sufficient
- ✅ No multi-environment configs

**Use turar-config** if:
- ✅ You have config files (JSON)
- ✅ Different configs per environment (dev/staging/prod)
- ✅ Need `${VAR}` interpolation in configs
- ✅ Want to centralize config management

## Advanced Examples

### Multi-Environment Setup

```bash
# File structure
config/
  default.json        # Base config (always loaded)
  development.json    # Local development
  staging.json        # Staging environment  
  production.json     # Production
```

```typescript
// Automatically loads config/{NODE_ENV}.json
process.env.NODE_ENV = "production";

const config = createConfigSync({
  schema: {
    api_url: eg.url().required(),
    database_pool_max: eg.integer().default(10),
  },
  configDir: "./config",
});

// In production: loads default.json + production.json
// Values from production.json override default.json
```

### Express.js Integration

```typescript
import express from "express";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    port: eg.port().default(3000),
    cors_origins: eg.array().of("string"),
    session_secret: eg.string().sensitive().required(),
    database_url: eg.url().required(),
  },
  configDir: "./config",
  envFile: true,
});

const app = express();

app.use(cors({ origin: config.cors_origins }));
app.use(session({ secret: config.session_secret }));

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
```

### NestJS Integration

```typescript
// config.service.ts
import { Injectable } from "@nestjs/common";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

@Injectable()
export class ConfigService {
  private readonly config = createConfigSync({
    schema: {
      database_host: eg.string().required(),
      database_port: eg.port().default(5432),
      redis_url: eg.url().required(),
      jwt_secret: eg.string().sensitive().required(),
    },
    configDir: "./config",
    prefix: "APP_",
  });

  get database() {
    return {
      host: this.config.database_host,
      port: this.config.database_port,
    };
  }

  get redis() {
    return this.config.redis_url;
  }
}
```

### Nested Object Configs

```json
// config/default.json
{
  "services": {
    "redis": {
      "host": "localhost",
      "port": 6379,
      "options": {
        "maxRetriesPerRequest": 3,
        "enableReadyCheck": true
      }
    },
    "database": {
      "primary": { "host": "db1.local", "port": 5432 },
      "replica": { "host": "db2.local", "port": 5432 }
    }
  }
}
```

```typescript
const config = createConfigSync({
  schema: {
    services_redis_host: eg.string(),
    services_redis_port: eg.port(),
    services_redis_options_maxRetriesPerRequest: eg.integer(),
    services_database_primary_host: eg.string(),
    services_database_primary_port: eg.port(),
    services_database_replica_host: eg.string(),
    services_database_replica_port: eg.port(),
  },
  configDir: "./config",
});

// Access flattened keys
const redisHost = config.services_redis_host;
const primaryDbHost = config.services_database_primary_host;
```

## Best Practices

### File Structure

```bash
project/
├── config/
│   ├── default.json       # Required: base config
│   ├── development.json   # Optional: overrides for dev
│   ├── test.json          # Optional: test environment
│   ├── staging.json       # Optional: staging env
│   └── production.json    # Optional: production env
├── .env                   # Optional: local overrides (gitignored)
├── .env.example           # Commit this: documents required env vars
└── src/
    └── config.ts          # Config setup
```

### Security Guidelines

**✅ DO:**
- Commit `config/*.json` files (non-sensitive defaults)
- Commit `.env.example` (template)
- Use `.sensitive()` for secrets in schema
- Use `${VAR}` interpolation for secrets in production.json
- Set real secrets via environment variables

**❌ DON'T:**
- Commit `.env` files (add to .gitignore)
- Put secrets directly in JSON files
- Commit production credentials
- Log config values marked `.sensitive()`

### Performance Tips

1. **Use `createConfigSync` when possible** - Faster startup
2. **Keep config files small** - Load time is linear with file size
3. **Minimize interpolations** - Each `${VAR}` is a lookup
4. **Use flattened schemas** - Avoid deep nesting (5+ levels)

### Naming Conventions

```typescript
// Consistent naming: lowercase with underscores
const schema = {
  database_url: eg.url(),           // ✅ Good
  database_connection_timeout: eg.integer(),  // ✅ Good
  
  DatabaseURL: eg.url(),            // ❌ Avoid
  "database-url": eg.url(),         // ❌ Avoid (kebab-case)
};

// Environment variable mapping
// With prefix="APP_":
// APP_database_url → config.database_url
// APP_database_connection_timeout → config.database_connection_timeout
```

## Troubleshooting

### Common Errors

#### "Invalid environment name"

```typescript
// ❌ Error: path traversal attempt
loadConfigFiles("./config", "../etc/passwd");

// ✅ Fix: use alphanumeric names only
loadConfigFiles("./config", "production");
```

#### "Undefined environment variable"

```json
// config/production.json
{ "api_key": "${API_KEY}" }
```

```bash
# ❌ Error: API_KEY not set
NODE_ENV=production node app.js

# ✅ Fix: set env var first
API_KEY=secret123 NODE_ENV=production node app.js
```

#### "Config file must contain a JSON object"

```json
// ❌ Invalid: array at root
["value1", "value2"]

// ✅ Valid: object at root
{ "values": ["value1", "value2"] }
```

### Debugging Config Loading

```typescript
import { createConfigSync } from "@yedoma-labs/turar-config";

try {
  const config = createConfigSync({
    schema: { /* ... */ },
    configDir: "./config",
  });
  
  // Log loaded config (excluding sensitive values)
  console.log("Config loaded:", JSON.stringify(config, null, 2));
  
} catch (error) {
  if (error instanceof ConfigFileError) {
    console.error("Failed to load:", error.path);
    console.error("Reason:", error.message);
  } else if (error instanceof ConfigInterpolationError) {
    console.error("Undefined variable:", error.variable);
  } else if (error instanceof EnvValidationError) {
    console.error("Validation failures:");
    for (const failure of error.failures) {
      console.error(`  ${failure.field}: ${failure.message}`);
    }
  }
}
```

### Environment Variable Priority

If a value isn't what you expect, check the priority order:

```bash
# Priority (highest to lowest):
1. process.env.APP_database_host      # Direct env var
2. .env file: APP_database_host=...   # .env file (if envFile: true)
3. config/production.json             # Environment config
4. config/default.json                # Base config
5. schema: eg.string().default(...)   # Schema default
```

## Migration Guides

See [docs/migration.md](./docs/migration.md) for detailed guides:

- [From dotenv](./docs/migration.md#from-dotenv)
- [From node-config](./docs/migration.md#from-node-config)
- [From rc](./docs/migration.md#from-rc)
- [From convict](./docs/migration.md#from-convict)

## Roadmap

- [ ] HashiCorp Vault integration
- [ ] AWS Secrets Manager support
- [ ] YAML config file support
- [ ] TOML config file support
- [ ] Config file watching / hot reload
- [ ] Config migration helpers

## License

MIT

## Related Projects

- [@yedoma-labs/turar-config](https://github.com/yedoma-labs/turar-config) - Zero-dependency env validation
