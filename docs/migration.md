# Migration Guide

This guide helps you migrate from popular configuration libraries to `@yedoma-labs/turar-config`.

## Table of Contents

- [From dotenv](#from-dotenv)
- [From node-config](#from-node-config)
- [From rc](#from-rc)
- [From convict](#from-convict)

---

## From dotenv

### Before (dotenv)

```javascript
// .env
DATABASE_URL=postgresql://localhost/myapp
PORT=3000
NODE_ENV=production

// app.js
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL; // string | undefined
const port = process.env.PORT; // string | undefined
const env = process.env.NODE_ENV;

// Manual parsing and defaults
const portNumber = port ? parseInt(port, 10) : 3000;

if (!dbUrl) {
  throw new Error('DATABASE_URL is required');
}
```

### After (turar-config)

```typescript
// config/default.json
{
  "database": {
    "url": "postgresql://localhost/myapp"
  },
  "server": {
    "port": 3000
  }
}

// app.ts
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    database_url: eg.url().required(),
    server_port: eg.port().default(3000),
  },
  configDir: "./config",
  envFile: true, // Still load .env file
});

// Type-safe and validated!
const dbUrl = config.database_url; // string (guaranteed)
const port = config.server_port; // number (auto-coerced)
```

### Benefits of Switching

✅ **Type safety** - TypeScript types inferred from schema  
✅ **Validation** - Fail fast on invalid config  
✅ **Type coercion** - Automatic string → number conversion  
✅ **Environment cascading** - Different configs per environment  
✅ **No runtime errors** - Required values checked at startup  

---

## From node-config

### Before (node-config)

```javascript
// config/default.json
{
  "database": {
    "host": "localhost",
    "port": 5432
  }
}

// config/production.json
{
  "database": {
    "host": "prod.db.com"
  }
}

// app.js
const config = require('config');

const dbHost = config.get('database.host'); // any type
const dbPort = config.get('database.port'); // any type

// No compile-time type checking
```

### After (turar-config)

```typescript
// Same JSON files (no changes needed!)

// app.ts
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    database_host: eg.string().required(),
    database_port: eg.port().default(5432),
  },
  configDir: "./config",
});

// Fully typed!
const dbHost = config.database_host; // string
const dbPort = config.database_port; // number
```

### Key Differences

| Feature | node-config | turar-config |
|---------|------------|--------------|
| **Type safety** | No | Yes (TypeScript) |
| **Validation** | Manual | Built-in with schema |
| **Env vars** | Custom variables only | Full integration |
| **Nested access** | `get('a.b.c')` | Flattened: `a_b_c` |
| **Performance** | Dynamic lookup | Pre-validated object |

---

## From rc

### Before (rc)

```javascript
// .myapprc
{
  "port": 3000,
  "database": {
    "host": "localhost"
  }
}

// app.js
const rc = require('rc');
const config = rc('myapp', {
  port: 3000,
  database: { host: 'localhost' }
});

// No validation, any type
const port = config.port; // could be string or number
```

### After (turar-config)

```typescript
// config/default.json (rename .myapprc)
{
  "port": 3000,
  "database": {
    "host": "localhost"
  }
}

// app.ts
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    port: eg.port().default(3000),
    database_host: eg.string().default("localhost"),
  },
  configDir: "./config",
  prefix: "MYAPP_", // Env vars: MYAPP_port, MYAPP_database_host
});

const port = config.port; // number (guaranteed)
```

### Migration Steps

1. Rename `.myapprc` → `config/default.json`
2. Define schema with validation rules
3. Replace `rc(appname)` with `createConfigSync()`
4. Update access patterns (flat keys instead of nested)

---

## From convict

### Before (convict)

```javascript
const convict = require('convict');

const config = convict({
  env: {
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV'
  },
  port: {
    format: 'port',
    default: 3000,
    env: 'PORT'
  }
});

config.validate({ allowed: 'strict' });

const port = config.get('port');
```

### After (turar-config)

```typescript
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    env: eg.enum(['production', 'development', 'test'] as const)
      .default('development'),
    port: eg.port().default(3000),
  },
  configDir: "./config",
  strict: true, // Equivalent to allowed: 'strict'
});

const port = config.port; // number
```

### Schema Mapping

| convict format | turar-config (bylyt) |
|---------------|---------------------|
| `'int'` | `eg.integer()` |
| `'port'` | `eg.port()` |
| `'url'` | `eg.url()` |
| `['a','b']` | `eg.enum(['a','b'] as const)` |
| `'email'` | `eg.email()` |
| `'boolean'` | `eg.boolean()` |
| `'String'` | `eg.string()` |

---

## General Migration Tips

### 1. Start with Schema Definition

Map your existing config structure to a bylyt schema:

```typescript
// Old config structure
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "credentials": {
      "user": "admin",
      "password": "secret"
    }
  }
}

// New schema (flattened)
{
  database_host: eg.string().required(),
  database_port: eg.port().default(5432),
  database_credentials_user: eg.string().required(),
  database_credentials_password: eg.string().sensitive().required(),
}
```

### 2. Handle Environment Variables

If you were using custom env var names:

```javascript
// Before
process.env.DB_HOST
process.env.DATABASE_PORT

// After - use prefix to maintain compatibility
const config = createConfigSync({
  schema: { database_host: eg.string(), database_port: eg.port() },
  prefix: "DB_",  // Reads DB_database_host, DB_database_port
});

// Or map manually in sources
const config = createConfigSync({
  schema: { database_host: eg.string(), database_port: eg.port() },
  sources: [{
    database_host: process.env.DB_HOST,
    database_port: process.env.DATABASE_PORT,
  }],
});
```

### 3. Preserve Multi-Environment Setup

Convert environment-specific configs:

```bash
# Before (node-config)
config/
  default.json
  production.json
  development.json

# After (turar-config) - same structure!
config/
  default.json
  production.json
  development.json
```

No changes needed! Just set `NODE_ENV`.

### 4. Add Validation Gradually

Start with basic types, then add constraints:

```typescript
// Phase 1: Basic types
{
  port: eg.integer(),
  host: eg.string(),
}

// Phase 2: Add constraints
{
  port: eg.port().min(1024).max(65535),
  host: eg.string().pattern(/^[a-z0-9.-]+$/),
}

// Phase 3: Add custom validation
{
  port: eg.port().validate(val => 
    val !== 3000 ? null : "Port 3000 is reserved"
  ),
}
```

### 5. Test Both Old and New

Run old and new configs in parallel during migration:

```typescript
// migration-test.ts
import oldConfig from './old-config-loader';
import { createConfigSync } from '@yedoma-labs/turar-config';

const newConfig = createConfigSync({/* ... */});

// Compare values
console.assert(oldConfig.database.host === newConfig.database_host);
console.assert(oldConfig.port === newConfig.port);
```

---

## Troubleshooting Migration Issues

### Nested Object Access

**Problem**: Old code uses `config.database.host`

**Solution**: Use flattened keys or destructure:

```typescript
const { database_host, database_port } = config;

// Or create a helper
const db = {
  host: config.database_host,
  port: config.database_port,
};
```

### Dynamic Config Keys

**Problem**: Old code uses `config.get(dynamicKey)`

**Solution**: Use TypeScript index signature (not recommended) or refactor:

```typescript
// Avoid dynamic access - define all keys in schema
const key = someCondition ? 'primary_db' : 'secondary_db';
const db = config[key]; // Type error - good! Catch at compile time
```

### Missing Type Coercion

**Problem**: Old library returned strings, app expects numbers

**Solution**: Use appropriate bylyt types:

```typescript
// Old: "3000" (string)
process.env.PORT

// New: 3000 (number)
const config = createConfigSync({
  schema: { port: eg.integer() }, // Auto-coerces "3000" → 3000
});
```

---

## Need Help?

- Check [examples/](../example/) for complete migration examples
- Open an issue: https://github.com/yedoma-labs/turar-config/issues
- Review [bylyt-env-guard docs](https://github.com/yedoma-labs/bylyt-env-guard) for schema options
