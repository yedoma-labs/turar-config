# Express App Example

Full-featured Express.js application demonstrating turar-config integration with production-ready patterns.

## Features

- ✅ Type-safe configuration
- ✅ Multi-environment setup
- ✅ Database configuration with connection pooling
- ✅ Redis integration (optional)
- ✅ CORS configuration from files
- ✅ Security headers (helmet)
- ✅ Request logging (morgan)
- ✅ Rate limiting
- ✅ Session management
- ✅ Health checks
- ✅ Deployment ready

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your settings
# (especially SESSION_SECRET)

# Run in development
npm run dev

# Run in production
npm start
```

## Configuration

### File Structure

```
config/
├── default.json       # Base configuration
├── development.json   # Development overrides
└── production.json    # Production settings
```

### Environment Variables

Required:
- `DB_PASSWORD` - Database password
- `SESSION_SECRET` - Session encryption secret

Optional (with defaults):
- `APP_server_port` - Server port (default: 3000)
- `APP_logging_level` - Log level (debug/info/warn/error)
- `DB_HOST` - Database host
- `REDIS_HOST` - Redis host (if enabled)

## Architecture

### Config Module (`src/config.ts`)

Centralized configuration with type safety:

```typescript
import { loadConfig } from "./config.js";

const config = loadConfig();

// TypeScript knows exact types
const port: number = config.server_port;
const level: "debug" | "info" | "warn" | "error" = config.logging_level;
```

### Server Setup (`src/index.ts`)

Express app using config throughout:

```typescript
app.use(cors({
  origin: config.cors_origins,      // From config files
  credentials: config.cors_credentials,
}));

app.listen(config.server_port, config.server_host);
```

## Endpoints

### `GET /`
Welcome message with environment info.

### `GET /health`
Health check endpoint.

```json
{
  "status": "healthy",
  "uptime": 123.45,
  "redis": "enabled"
}
```

### `GET /config-info`
Non-sensitive configuration details.

```json
{
  "server": { "port": 3000, "host": "0.0.0.0" },
  "database": { "host": "localhost", "port": 5432 },
  "redis": { "enabled": true },
  "logging": { "level": "info" }
}
```

## Environment-Specific Behavior

### Development
- Debug logging enabled
- Permissive rate limits (1000 req/15min)
- Multiple CORS origins
- Development database

### Production
- Warn-level logging
- Strict rate limits (50 req/min)
- Specific CORS origins
- Production database with SSL
- Redis caching enabled
- Trust proxy headers

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
ENV NODE_ENV=production
CMD ["node", "src/index.ts"]
```

### Environment Variables (Production)

```bash
NODE_ENV=production
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_NAME=myapp
DB_USER=app_user
DB_PASSWORD=secure-password
REDIS_HOST=redis.example.com
REDIS_PORT=6379
SESSION_SECRET=random-secure-secret
APP_server_port=8080
```

## Database Integration Example

```typescript
import pg from "pg";
import { config } from "./config.js";

const pool = new pg.Pool({
  host: config.database_host,
  port: config.database_port,
  database: config.database_name,
  user: config.database_user,
  password: config.database_password,
  min: config.database_pool_min,
  max: config.database_pool_max,
  ssl: config.database_ssl,
});

export { pool };
```

## Redis Integration Example

```typescript
import { createClient } from "redis";
import { config } from "./config.js";

const redis = config.redis_enabled
  ? createClient({
      socket: {
        host: config.redis_host,
        port: config.redis_port,
      },
    })
  : null;

export { redis };
```

## Best Practices Demonstrated

1. **Separate config module** - Centralized config loading
2. **Type-safe access** - Full TypeScript inference
3. **Environment-specific behavior** - Different configs per environment
4. **Secret management** - Sensitive values marked and loaded from env
5. **Validation** - Schema ensures all required values present
6. **Cascading** - Base config + environment overrides
7. **Interpolation** - Reference env vars in JSON files

## Next Steps

- Add database migrations
- Implement authentication
- Add API versioning
- Set up monitoring/metrics
- Add integration tests
