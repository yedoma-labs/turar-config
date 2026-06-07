# TypeScript Strict Mode Example

Demonstrates maximum type safety with turar-config in TypeScript strict mode.

## Features

- ✅ Full TypeScript strict mode enabled
- ✅ Complete type inference from schema
- ✅ No type assertions required
- ✅ Compile-time error detection
- ✅ Autocomplete for config keys
- ✅ Type-safe helper classes
- ✅ Readonly configurations

## What is TypeScript Strict Mode?

All these compiler options are enabled:

```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noUncheckedIndexedAccess": true,
  "noPropertyAccessFromIndexSignature": true
}
```

## Running the Example

```bash
npm install

# Run the demo
npm run dev

# Run type tests
npm run test

# Type check only (no execution)
npm run typecheck
```

## Type Safety Demonstrations

### 1. Automatic Type Inference

```typescript
const config = getConfig();

// TypeScript knows exact types - no annotations needed!
const url = config.api_baseUrl;        // string
const timeout = config.api_timeout;    // number
const enabled = config.features_enableCache; // boolean
```

### 2. Compile-Time Error Detection

```typescript
// ✗ TypeScript error: Property 'typo' does not exist
const wrong = config.typo;

// ✗ TypeScript error: Type 'number' is not assignable to type 'string'
const invalid: string = config.api_timeout;

// ✗ TypeScript error: Argument of type '"invalid"' is not assignable
service.get("invalid");
```

### 3. Full IDE Support

Your IDE will:
- Autocomplete all config keys
- Show type information on hover
- Catch errors before running code
- Enable safe refactoring

### 4. Type-Safe Helpers

```typescript
class ConfigService {
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
}

// Return type is inferred correctly
const timeout: number = service.get("api_timeout"); // ✓
```

### 5. Readonly Configurations

```typescript
const readonlyConfig = service.getAll();

// ✗ TypeScript error: Cannot assign to read-only property
readonlyConfig.api_timeout = 1000;
```

## Schema Definition Best Practices

### Use `as const` for Maximum Type Safety

```typescript
export const appConfigSchema = {
  api_baseUrl: eg.url().required(),
  api_timeout: eg.integer().default(5000),
} as const;
//  ^^^^^^^^ This is important!

export type AppConfig = InferEnv<typeof appConfigSchema>;
```

### Separate Schema from Implementation

```typescript
// config.ts - Define once
export const configSchema = { /* ... */ } as const;
export type Config = InferEnv<typeof configSchema>;

// Use everywhere
import type { Config } from "./config";
function useConfig(cfg: Config) { /* ... */ }
```

## Pattern: Configuration Service

```typescript
class ConfigService {
  private readonly config: AppConfig;

  constructor() {
    this.config = getConfig();
  }

  // Specific getters with exact return types
  getApiTimeout(): number {
    return this.config.api_timeout;
  }

  // Generic getter preserving types
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }
}
```

## Pattern: Config Validation

```typescript
function validateConfig(cfg: AppConfig): void {
  // Type-safe validation
  if (cfg.api_timeout < 1000) {
    throw new Error("Timeout too low");
  }

  if (cfg.features_maxConnections <= 0) {
    throw new Error("Invalid max connections");
  }
}
```

## Pattern: Dependency Injection

```typescript
interface ApiClient {
  baseUrl: string;
  timeout: number;
}

function createApiClient(config: AppConfig): ApiClient {
  return {
    baseUrl: config.api_baseUrl,
    timeout: config.api_timeout,
  };
}

const client = createApiClient(getConfig());
```

## Benefits Over Alternatives

### vs. Plain Environment Variables

```typescript
// ❌ No type safety
const timeout = parseInt(process.env.API_TIMEOUT || "5000");

// ✓ Full type safety
const timeout = config.api_timeout; // number
```

### vs. Manual Type Assertions

```typescript
// ❌ Runtime errors possible
const timeout = process.env.API_TIMEOUT as unknown as number;

// ✓ Validated at load time
const timeout = config.api_timeout; // guaranteed to be number
```

### vs. Config Libraries Without Types

```typescript
// ❌ No autocomplete, no type checking
const timeout = config.get("api.timeout");

// ✓ Autocomplete, type checking, refactoring
const timeout = config.api_timeout;
```

## Type System Features Leveraged

- **Type Inference** - TypeScript infers types from schema
- **Literal Types** - `as const` for exact type preservation
- **Mapped Types** - `InferEnv<T>` generates config type
- **Index Signatures** - `AppConfig[K]` for generic access
- **Readonly Types** - `Readonly<T>` for immutability
- **Union Types** - Enum values as literal unions

## Testing Type Safety

The `type-tests.ts` file includes 10 comprehensive tests that verify:

1. Basic type inference
2. Exhaustive property access
3. Type narrowing in conditionals
4. Service class type safety
5. Generic getter type preservation
6. Readonly configurations
7. Type-safe function parameters
8. Conditional logic with types
9. Destructuring with type preservation
10. Mapped types

Run with `npm run test` to see all tests pass!

## Next Steps

- Integrate with your framework (Express, Fastify, NestJS)
- Add custom validation functions
- Create domain-specific config services
- Use in tests with different config values
