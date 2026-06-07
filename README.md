# @yedoma-labs/turar-config

Type-safe configuration management with file loading, environment cascading, and secrets integration. Extends [@yedoma-labs/bylyt-env-guard](https://github.com/yedoma-labs/bylyt-env-guard) with advanced config file handling.

## Features

- 📁 **File-based config** - Load JSON configs from `config/` directory
- 🌍 **Environment cascading** - Merge `default.json` → `{NODE_ENV}.json` → env vars
- 🔒 **Secrets integration** - Support for `.env` files and vault providers (Vault support coming soon)
- 🔐 **Type-safe** - Full TypeScript inference from schema
- ✅ **Validation** - Uses bylyt's zero-dependency validation
- 🔗 **Interpolation** - Reference env vars with `${VAR}` syntax in config files
- 🚀 **Zero dependencies** - Only peer depends on bylyt-env-guard

## Installation

```bash
npm install @yedoma-labs/turar-config @yedoma-labs/bylyt-env-guard
# or
pnpm add @yedoma-labs/turar-config @yedoma-labs/bylyt-env-guard
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
import { eg } from "@yedoma-labs/bylyt-env-guard";
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
import { eg } from "@yedoma-labs/bylyt-env-guard";
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

- [@yedoma-labs/bylyt-env-guard](https://github.com/yedoma-labs/bylyt-env-guard) - Zero-dependency env validation
