# Basic App Example

Minimal working example demonstrating turar-config in a simple application.

## Features Demonstrated

- ✅ Multi-environment configuration (dev/prod)
- ✅ Environment variable interpolation
- ✅ Type-safe config access
- ✅ Default values
- ✅ Config file cascading

## File Structure

```
basic-app/
├── config/
│   ├── default.json       # Base configuration
│   ├── development.json   # Dev overrides
│   └── production.json    # Production settings
├── src/
│   └── index.ts          # Application entry point
├── .env.example          # Environment variable template
└── package.json
```

## Running the Example

### Development Mode

```bash
npm install
npm run dev
```

This loads:
1. `config/default.json`
2. `config/development.json` (merges with default)
3. `.env` file (if exists)
4. Environment variables with `APP_` prefix

### Production Mode

```bash
# Set required environment variables
export DB_HOST=prod-db.example.com
export DB_PORT=5432
export DB_NAME=myapp_production

npm run prod
```

This loads:
1. `config/default.json`
2. `config/production.json` (interpolates `${DB_HOST}` etc.)
3. Environment variables

## Configuration Priority

From highest to lowest priority:

1. **Environment variables** - `APP_server_port=9000`
2. **`.env` file** - `APP_server_port=8000`
3. **Environment config** - `config/production.json`
4. **Base config** - `config/default.json`
5. **Schema defaults** - `.default(3000)`

## Key Concepts

### Type Safety

```typescript
const config = createConfigSync({ schema, configDir: "./config" });

// TypeScript knows exact types
const port: number = config.server_port; // ✓
const level: "debug" | "info" | "warn" | "error" = config.logging_level; // ✓
```

### Environment Interpolation

```json
// config/production.json
{
  "database": {
    "host": "${DB_HOST}"
  }
}
```

At runtime, `${DB_HOST}` is replaced with the actual env var value.

### Deep Merging

```json
// default.json
{ "database": { "host": "localhost", "port": 5432 } }

// production.json
{ "database": { "host": "prod.db" } }

// Result in production:
// { "database": { "host": "prod.db", "port": 5432 } }
```

## Next Steps

- Check out [express-app](../express-app) for a full web server example
- See [typescript-strict](../typescript-strict) for advanced type patterns
- Read the [main documentation](../../README.md) for complete API reference
