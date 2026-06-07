# Express.js Integration Example

Full-featured Express.js application demonstrating turar-config usage with:
- Multi-environment configuration (dev/production)
- Type-safe config access
- CORS, database, and Redis configuration
- Feature flags
- Health check endpoint

## Quick Start

```bash
# Install dependencies
pnpm install

# Run in development
pnpm dev

# Run in production
NODE_ENV=production \
  DB_HOST=prod.db.com \
  DB_NAME=myapp_prod \
  REDIS_URL=redis://prod.redis.com:6379 \
  pnpm start
```

## Configuration

### Development (default.json)

```json
{
  "server": { "port": 3000, "host": "0.0.0.0" },
  "database": { "host": "localhost", "port": 5432, "name": "myapp_dev" },
  "redis": { "url": "redis://localhost:6379" }
}
```

### Production (production.json)

```json
{
  "server": { "port": 8080 },
  "database": { "host": "${DB_HOST}", "name": "${DB_NAME}" },
  "redis": { "url": "${REDIS_URL}" }
}
```

Environment variables override JSON config:
```bash
APP_server_port=9000 pnpm dev  # Runs on port 9000
```

## Endpoints

- `GET /health` - Health check with config info
- `GET /api/config` - Current configuration (non-sensitive)

## Project Structure

```
express-app/
├── config/
│   ├── default.json      # Development defaults
│   └── production.json   # Production overrides
├── src/
│   └── index.ts          # Main Express app
├── package.json
└── README.md
```

## Features Demonstrated

✅ Type-safe configuration  
✅ Multi-environment support (NODE_ENV)  
✅ Environment variable interpolation (`${VAR}`)  
✅ CORS configuration from config  
✅ Database connection settings  
✅ Redis URL configuration  
✅ Feature flags (metrics, debug)  
✅ Graceful shutdown  
