# Migration Guide

Guide for migrating to `@yedoma-labs/turar-config` from other configuration libraries.

## Table of Contents

- [From dotenv](#from-dotenv)
- [From node-config](#from-node-config)
- [From rc](#from-rc)
- [From convict](#from-convict)
- [From config (lorenwest/node-config)](#from-config-lorenwestnode-config)

---

## From dotenv

### Before (dotenv)

```javascript
// .env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=myapp
SERVER_PORT=3000

// app.js
require('dotenv').config();

const config = {
  database: {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    name: process.env.DATABASE_NAME,
  },
  server: {
    port: parseInt(process.env.SERVER_PORT || '3000'),
  },
};

// No type safety
// Manual parsing required
// No validation
// No defaults in code
```

### After (turar-config)

```typescript
// config/default.json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "myapp"
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
    database_host: eg.string().required(),
    database_port: eg.port().default(5432),
    database_name: eg.string().required(),
    server_port: eg.port().default(3000),
  },
  configDir: "./config",
  envFile: true, // Still supports .env!
});

// Full type safety ✓
// Automatic parsing ✓
// Built-in validation ✓
// Defaults in schema ✓
```

### Migration Steps

1. **Create config directory:**
   ```bash
   mkdir config
   ```

2. **Convert .env to config/default.json:**
   ```bash
   # Extract non-secret values to config/default.json
   # Keep secrets in .env
   ```

3. **Define schema:**
   ```typescript
   const schema = {
     database_host: eg.string().required(),
     database_port: eg.port().default(5432),
     // ... etc
   };
   ```

4. **Update imports:**
   ```typescript
   // Remove: require('dotenv').config();
   // Add: import { createConfigSync } from "@yedoma-labs/turar-config";
   ```

5. **Update config access:**
   ```typescript
   // Before: process.env.DATABASE_HOST
   // After:  config.database_host
   ```

### Benefits

- **Type Safety**: TypeScript knows exact types
- **Validation**: Errors caught at startup
- **No Manual Parsing**: `eg.port()` handles conversion
- **Config Files**: Separate concerns (code vs. config)
- **Multi-Environment**: Different configs per environment

---

## From node-config

### Before (node-config)

```javascript
// config/default.json
{
  "server": {
    "port": 3000
  },
  "database": {
    "host": "localhost"
  }
}

// app.js
const config = require('config');

const port = config.get('server.port');
const host = config.get('database.host');

// Runtime type checking only
// No TypeScript support
// Magic environment detection
```

### After (turar-config)

```typescript
// config/default.json (same structure works!)
{
  "server": {
    "port": 3000
  },
  "database": {
    "host": "localhost"
  }
}

// app.ts
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    server_port: eg.port().default(3000),
    database_host: eg.string().required(),
  },
  configDir: "./config",
});

const port = config.server_port;  // Type: number
const host = config.database_host; // Type: string

// Compile-time type checking ✓
// Full TypeScript support ✓
// Explicit configuration ✓
```

### Migration Steps

1. **Keep existing config files** - They work as-is!

2. **Add schema definition:**
   ```typescript
   // Create src/config.ts
   export const configSchema = {
     server_port: eg.port(),
     database_host: eg.string(),
     // Map nested objects to flat keys
   };
   ```

3. **Update config access:**
   ```typescript
   // Before: config.get('server.port')
   // After:  config.server_port
   ```

4. **Handle nested objects:**
   ```typescript
   // JSON: { "a": { "b": { "c": "value" } } }
   // Schema: a_b_c: eg.string()
   ```

5. **Test environment overrides:**
   ```bash
   NODE_ENV=production node app.js
   ```

### Key Differences

| Feature | node-config | turar-config |
|---------|-------------|--------------|
| Type Safety | ❌ Runtime only | ✅ Compile-time |
| Access Pattern | `.get('a.b.c')` | `.a_b_c` |
| Validation | ❌ Manual | ✅ Automatic |
| TypeScript | ⚠️ Basic | ✅ Full inference |
| Env Vars | ⚠️ Limited | ✅ First-class |

---

## From rc

### Before (rc)

```javascript
// .apprc
{
  "port": 8000,
  "host": "localhost"
}

// app.js
const conf = require('rc')('app', {
  port: 8000,
  host: 'localhost'
});

console.log(conf.port); // Could be any type
```

### After (turar-config)

```typescript
// config/default.json
{
  "port": 8000,
  "host": "localhost"
}

// app.ts
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    port: eg.port().default(8000),
    host: eg.string().default("localhost"),
  },
  configDir: "./config",
  prefix: "app_",
});

console.log(config.port); // Type: number
```

### Migration Steps

1. **Rename config files:**
   ```bash
   mv .apprc config/default.json
   ```

2. **Move defaults to schema:**
   ```typescript
   const schema = {
     port: eg.port().default(8000),
     host: eg.string().default("localhost"),
   };
   ```

3. **Update environment variable names:**
   ```bash
   # Before: app_port
   # After:  app_port (same if using prefix: "app_")
   ```

4. **Update access pattern:**
   ```typescript
   // Before: conf.port
   // After:  config.port (same!)
   ```

### Benefits

- **Type Safety**: Know types at compile time
- **Validation**: Invalid values caught early
- **Better Errors**: Clear messages on validation failure
- **IDE Support**: Autocomplete for config keys

---

## From convict

### Before (convict)

```javascript
const convict = require('convict');

const config = convict({
  env: {
    doc: 'The application environment',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV'
  },
  port: {
    doc: 'The port to bind',
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
    env: eg.enum(["production", "development", "test"] as const)
      .default("development"),
    port: eg.port().default(3000),
  },
  configDir: "./config",
  strict: true, // Equivalent to allowed: 'strict'
});

const port = config.port; // Type: number
```

### Migration Steps

1. **Convert schema format:**
   ```typescript
   // Before (convict):
   {
     port: {
       format: 'port',
       default: 3000,
       env: 'PORT'
     }
   }

   // After (turar-config):
   {
     port: eg.port().default(3000)
   }
   // ENV var PORT is automatically picked up
   ```

2. **Map convict formats to bylyt validators:**

   | Convict | turar-config |
   |---------|--------------|
   | `'port'` | `eg.port()` |
   | `'int'` | `eg.integer()` |
   | `'nat'` | `eg.integer().min(0)` |
   | `'url'` | `eg.url()` |
   | `['a','b']` | `eg.enum(['a','b'] as const)` |
   | `'email'` | `eg.email()` |
   | `Boolean` | `eg.boolean()` |
   | `Number` | `eg.number()` |
   | `String` | `eg.string()` |

3. **Update access pattern:**
   ```typescript
   // Before: config.get('port')
   // After:  config.port
   ```

4. **Handle nested config:**
   ```typescript
   // Before: config.get('database.host')
   // After:  config.database_host
   ```

### Comparison

| Feature | convict | turar-config |
|---------|---------|--------------|
| Type Inference | ❌ | ✅ |
| Config Files | ⚠️ Limited | ✅ Full support |
| Validation | ✅ | ✅ |
| Environment Vars | ✅ | ✅ |
| TypeScript | ⚠️ Basic | ✅ Full |

---

## From config (lorenwest/node-config)

Comprehensive migration from the popular `config` library.

### Before (config)

```javascript
// config/default.js
module.exports = {
  server: {
    port: 3000,
    host: 'localhost'
  },
  database: {
    host: 'localhost',
    port: 5432,
    name: 'myapp'
  }
};

// config/production.js
module.exports = {
  server: {
    port: 8080
  },
  database: {
    host: process.env.DB_HOST
  }
};

// app.js
const config = require('config');

app.listen(config.get('server.port'));
db.connect(config.get('database.host'));
```

### After (turar-config)

```typescript
// config/default.json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "database": {
    "host": "localhost",
    "port": 5432,
    "name": "myapp"
  }
}

// config/production.json
{
  "server": {
    "port": 8080
  },
  "database": {
    "host": "${DB_HOST}"
  }
}

// app.ts
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

const config = createConfigSync({
  schema: {
    server_port: eg.port().default(3000),
    server_host: eg.string().default("localhost"),
    database_host: eg.string().required(),
    database_port: eg.port().default(5432),
    database_name: eg.string().required(),
  },
  configDir: "./config",
});

app.listen(config.server_port);
db.connect(config.database_host);
```

### Migration Steps

1. **Convert .js files to .json:**
   ```bash
   # config/default.js → config/default.json
   # Remove module.exports, keep JSON
   ```

2. **Replace process.env with interpolation:**
   ```json
   // Before: "host": process.env.DB_HOST
   // After:  "host": "${DB_HOST}"
   ```

3. **Define schema:**
   ```typescript
   const schema = {
     server_port: eg.port(),
     server_host: eg.string(),
     database_host: eg.string(),
     // ... flatten nested structure
   };
   ```

4. **Update imports:**
   ```typescript
   // Remove: const config = require('config');
   // Add: import { createConfigSync } from "@yedoma-labs/turar-config";
   ```

5. **Update access:**
   ```typescript
   // Before: config.get('server.port')
   // After:  config.server_port
   ```

### Feature Mapping

| node-config | turar-config |
|-------------|--------------|
| `config/default.js` | `config/default.json` |
| `config.get('a.b')` | `config.a_b` |
| `process.env.VAR` in files | `"${VAR}"` interpolation |
| `config.has('key')` | `key in config` |
| Custom validation | Schema validation |
| Type definitions (manual) | Automatic type inference |

---

## General Migration Checklist

- [ ] Install dependencies: `npm install @yedoma-labs/turar-config @yedoma-labs/bylyt-env-guard`
- [ ] Create `config/` directory
- [ ] Create `config/default.json` with base config
- [ ] Create environment-specific configs (development.json, production.json)
- [ ] Define schema with `eg.*` validators
- [ ] Replace old config access with new patterns
- [ ] Update environment variables to use new naming
- [ ] Add type annotations (TypeScript)
- [ ] Test all environments
- [ ] Update documentation
- [ ] Remove old config library

## Common Patterns

### Environment Detection

```typescript
// Before
const env = process.env.NODE_ENV || 'development';

// After
// Automatically handled by turar-config based on NODE_ENV
```

### Dynamic Imports

```typescript
// Before
const config = require(`./config/${env}.js`);

// After
// Automatic - just use configDir option
createConfigSync({ schema, configDir: "./config" });
```

### Conditional Config

```typescript
// Before
const config = isDev ? devConfig : prodConfig;

// After
// Handled by environment files (development.json vs production.json)
```

## Troubleshooting

### "Config file not found"
- Ensure `config/default.json` exists
- Check `configDir` option points to correct directory

### "Validation failed"
- Check all required fields are provided
- Verify environment variables are set
- Use `.optional()` for non-required fields

### Type errors
- Ensure schema uses `as const`
- Import `InferEnv` type: `import type { InferEnv } from "@yedoma-labs/bylyt-env-guard"`

## Need Help?

- 📖 [Documentation](../README.md)
- 💬 [Discussions](https://github.com/yedoma-labs/turar-config/discussions)
- 🐛 [Issue Tracker](https://github.com/yedoma-labs/turar-config/issues)
