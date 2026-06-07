# Turar Config Example

This example demonstrates a typical web application configuration setup.

## Structure

```
example/
├── config/
│   ├── default.json      # Base configuration
│   └── production.json   # Production overrides
├── .env.example          # Example environment variables
└── index.ts              # Example application
```

## Running the Example

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run in development mode:
   ```bash
   NODE_ENV=development tsx example/index.ts
   ```

3. Run in production mode:
   ```bash
   NODE_ENV=production DB_HOST=prod.example.com tsx example/index.ts
   ```

4. Override specific values:
   ```bash
   NODE_ENV=development APP_server_port=8080 APP_logging_level=debug tsx example/index.ts
   ```

## Configuration Cascade

The example demonstrates how values cascade:

1. **Base** (`config/default.json`):
   - `server.port: 3000`
   - `database.host: "localhost"`
   - `logging.level: "info"`

2. **Production** (`config/production.json`):
   - `server.port: 8080` (overrides default)
   - `database.host: "${DB_HOST}"` (interpolates from env)
   - `logging.level: "warn"` (overrides default)

3. **Environment variables**:
   - `APP_server_port` overrides config files
   - `DB_HOST` is interpolated into config values
   - `APP_logging_level` overrides config files

## Key Features Demonstrated

- ✅ JSON config file loading
- ✅ Environment-specific configs (dev vs prod)
- ✅ Variable interpolation (`${DB_HOST}`)
- ✅ Environment variable overrides
- ✅ Prefix support (`APP_` prefix)
- ✅ Type-safe configuration access
- ✅ Default values
- ✅ Validation (required fields, enums, ranges)
