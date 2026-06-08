# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-06-08

### Added

- **AWS Secrets Manager integration** with loose coupling
  - Optional dependency pattern (`@aws-sdk/client-secrets-manager`)
  - Dynamic imports for zero overhead when not used
  - Region configuration with validation (us-east-1, eu-west-2, etc.)
  - Secret name validation (1-512 chars, alphanumeric + /_+=.@-)
  - Custom endpoint support (LocalStack, testing)
  - IAM role support (recommended) and explicit credentials
  - Temporary credential support (sessionToken)
  - Automatic secret flattening with underscore separator
  - Array value preservation via JSON.stringify
  - JSON-only secrets (binary not supported)
  - Endpoint URL validation (http/https only, prevents SSRF)
  - Error message sanitization (200 char limit)
  - 15 comprehensive tests in aws-secrets-manager.test.ts
- **Enhanced security test suite** (21 new tests in security-enhanced.test.ts)
  - ReDoS prevention tests (large strings, nested braces, expansion attacks)
  - Circular reference detection tests (direct cycles, array cycles, deep cycles)
  - File size limit tests (reject >10MB, accept <10MB)
  - Vault security tests (URL/path validation, SSRF prevention, depth limits)
  - Separator validation tests
  - Prototype pollution variation tests
  - Windows path separator tests
- **Comprehensive AWS Secrets Manager documentation**
  - Complete configuration examples
  - Security best practices
  - LocalStack testing guide
  - IAM policy examples
  - Comparison with HashiCorp Vault

### Changed

- **Package dependencies restructure**
  - `node-vault` moved to `optionalDependencies`
  - `@aws-sdk/client-secrets-manager` added as `optionalDependencies`
  - Pay-as-you-go dependency model (install only what you use)
  - Clear error messages when optional package not installed
- **Interpolation engine**: Manual parser replaces regex (faster, safer)
- **Vault secret handling**: Arrays now JSON.stringify'd to preserve type info
- **Watcher behavior**: Config always updates on successful reload (onChange errors don't rollback)
- **Test coverage**: 149 → 185 tests (+36 tests)

### Fixed

- **Critical security vulnerabilities** (comprehensive security audit)
  - **ReDoS prevention**: Replaced regex interpolation with manual parser (eliminates catastrophic backtracking)
  - **Circular reference detection**: Added WeakSet-based cycle detection in interpolateObject
  - **File size limits**: 10MB max file size check before reading (prevents OOM attacks)
  - **Vault URL validation**: Only allow http/https protocols, validate hostname (prevents SSRF)
  - **Vault path validation**: Block path traversal (..), only allow safe characters
  - **Vault depth limits**: MAX_DEPTH=100 in flattenSecrets (prevents DoS)
  - **Windows path traversal**: Explicit backslash rejection in environment names
  - **Error message security**: Sanitize to first line only, 200 char limit (prevents info disclosure)
  - **Watcher race conditions**: Proper error handler cleanup, stopped flag protection
  - **Separator validation**: Non-empty, non-alphanumeric enforcement in flattenObject
  - **Prototype pollution hardening**: Block ___proto__, __proto, CONSTRUCTOR, PROTOTYPE variations
  - **Path sanitization**: Better ConfigFileError path display (basename + first 100 chars)
- **Documentation fixes**
  - Fixed missing imports in code examples
  - Corrected import statements and priority order

## [0.2.0] - 2026-06-07

### Added

- **HashiCorp Vault integration** for secrets management
  - Token authentication support
  - AppRole authentication support (recommended for production)
  - Automatic secret flattening with underscore separator
  - Custom mount paths and namespaces (Vault Enterprise)
  - Legacy config format backward compatibility
  - Error sanitization for security (200 char limit)
- **Config file watching** with hot reload support
  - Watch all config formats (JSON, YAML, TOML) automatically
  - Debouncing to prevent excessive reloads (default 500ms)
  - `onChange` callback with old/new config and change metadata
  - `WatchHandle` for programmatic control (stop, getConfig)
  - Support for ignoreInitial option
- **YAML config file support**
  - Auto-detection for `.yaml` and `.yml` files
  - Full YAML syntax support with `yaml` library
- **TOML config file support**
  - Auto-detection for `.toml` files
  - Full TOML syntax support with `@iarna/toml` library
- **Format priority system**: YAML > TOML > JSON
  - Automatically selects highest-priority format when multiple exist
  - Documented in code and README
- **Comprehensive test suite**
  - 149 total tests (up from 0)
  - 98.36% code coverage
  - 28 security-specific tests
  - 14 Vault integration tests
  - 17 coverage-boost tests
  - 11 YAML/TOML format tests
  - 10 file watching tests
- **Migration guides**
  - From dotenv to turar-config
  - From node-config to turar-config
  - From rc to turar-config
  - From convict to turar-config
- **Example applications**
  - Express.js integration example
  - Complete setup with TypeScript
  - Environment-specific configuration
- **CI/CD workflows**
  - GitHub Actions for automated testing
  - Coverage reporting
  - Linting and type checking

### Changed

- **Updated feature list** in README to reflect all capabilities
  - Multi-format config (JSON, YAML, TOML)
  - HashiCorp Vault secrets integration
  - File watching with hot reload
- **Enhanced type definitions**
  - `VaultConfig` interface with structured configuration
  - `VaultAuth` union type (token | appRole)
  - `VaultAuthToken` and `VaultAuthAppRole` interfaces
  - `WatchConfigOptions` extending `CreateConfigOptions`
  - `ConfigChange` interface for file watch events
  - `WatchHandle` generic interface
- **Improved error handling**
  - Added `cause` parameter to `ConfigSecretError`
  - Better error messages for all scenarios
  - Error message sanitization to prevent data leaks

### Fixed

- **Critical security vulnerabilities**
  - Path traversal protection with strict validation
  - Prototype pollution prevention (blocks `__proto__`, `constructor`, `prototype`)
  - DoS prevention with depth limits (max 100 levels)
  - String length limits (max 10,000 chars)
  - Environment name validation (`/^[a-zA-Z0-9_-]+$/`)
- **File watcher race conditions**
  - Moved debounce timer from global to per-watcher instance
  - Added `stopped` flag to prevent onChange after stop()
  - Protected currentConfig updates (only after successful onChange)
  - Proper cleanup on initial load failure
- **Error message security**
  - Sanitize YAML/TOML parse errors (200 char limit)
  - Prevent file content leakage in error messages
  - Vault error sanitization
- **Type safety improvements**
  - Fixed TypeScript compilation errors
  - Removed unreachable watcher cleanup code
  - Proper type inference for all APIs

### Security

- **Path traversal protection**
  - Validates config directory paths
  - Rejects `..` path segments
  - Prevents access outside intended directories
- **Prototype pollution prevention**
  - Blocks dangerous property names (`__proto__`, `constructor`, `prototype`)
  - Safe object merging with property validation
- **Denial of Service (DoS) prevention**
  - Maximum nesting depth of 100 levels
  - Maximum string length of 10,000 characters
  - Prevents infinite loops and stack overflows
- **Secrets protection**
  - Never logs tokens or secrets
  - Error message sanitization
  - Secure default configurations
- **Input validation**
  - Environment name regex validation
  - File path validation
  - Schema validation via bylyt-env-guard

## [0.1.0] - 2026-06-07

### Added

- **Initial release** of @yedoma-labs/turar-config
- **Core configuration management**
  - File-based config loading from `config/` directory
  - Environment cascading (`default.json` → `{NODE_ENV}.json` → env vars)
  - Type-safe configuration with full TypeScript support
  - Schema validation using @yedoma-labs/bylyt-env-guard
- **JSON config file support**
  - Load JSON configuration files
  - Automatic parsing and validation
- **Variable interpolation**
  - Reference environment variables with `${VAR}` syntax
  - Escape syntax `\${VAR}` for literal values
  - Nested interpolation support
- **.env file integration**
  - Load environment variables from .env files
  - Custom .env file path support
  - Merge with system environment variables
- **Configuration merging**
  - Deep merge of configuration objects
  - Array replacement (not merge)
  - Null and undefined value handling
- **Secrets provider support**
  - Environment variable provider
  - Extensible provider architecture (Vault stub)
- **Comprehensive API**
  - `createConfig()` - async configuration loading
  - `createConfigSync()` - synchronous configuration loading
  - Full TypeScript type inference from schema
  - Support for custom prefixes
  - Strict mode option
- **Error handling**
  - `ConfigError` base class
  - `ConfigFileError` for file-related issues
  - `ConfigInterpolationError` for variable expansion issues
  - `ConfigSecretError` for secrets provider issues
  - Detailed error messages with context

### Dependencies

- `@yedoma-labs/bylyt-env-guard` - Zero-dependency env validation (peer)
- `yaml@^2.9.0` - YAML parsing
- `@iarna/toml@^2.2.5` - TOML parsing
- `chokidar@^3.6.0` - File watching
- `node-vault@^0.12.0` - HashiCorp Vault client

### Development Dependencies

- TypeScript 5.x
- Vitest for testing
- Biome for linting
- ESLint with TypeScript support

## [Unreleased]

### Planned

- Azure Key Vault integration
- Google Cloud Secret Manager integration
- Config migration helpers
- Config validation CLI tool
- Hot reload for production (optional)
- Remote config support (HTTP/HTTPS)
- Config encryption at rest
- Audit logging for config changes

---

## Version Comparison

### v0.3.0 vs v0.2.0

**Major Additions:**
- ✅ AWS Secrets Manager integration
- ✅ Optional dependencies pattern (loose coupling)
- ✅ 36 additional tests (security + AWS)
- ✅ Enhanced security hardening (ReDoS, circular refs, file size limits)
- ✅ Comprehensive AWS documentation

**Statistics:**
- Tests: 149 → 185 (+36)
- Secrets Providers: 2 (env, vault) → 3 (env, vault, aws)
- Optional Dependencies: 0 → 2 (@aws-sdk/client-secrets-manager, node-vault)
- Security Tests: 28 → 49 (+21)

**Breaking Changes:**
- None - fully backward compatible

### v0.2.0 vs v0.1.0

**Major Additions:**
- ✅ HashiCorp Vault secrets integration
- ✅ File watching with hot reload
- ✅ YAML and TOML format support
- ✅ 149 comprehensive tests (98.36% coverage)
- ✅ Critical security fixes
- ✅ Migration guides and examples

**Statistics:**
- Tests: 0 → 149 (+149)
- Coverage: 0% → 98.36%
- Formats: 1 (JSON) → 3 (JSON, YAML, TOML)
- Secrets Providers: 1 (env) → 2 (env, vault)
- Security Tests: 0 → 28

**Breaking Changes:**
- None - fully backward compatible

---

## Links

- [GitHub Repository](https://github.com/yedoma-labs/turar-config)
- [npm Package](https://www.npmjs.com/package/@yedoma-labs/turar-config)
- [Issue Tracker](https://github.com/yedoma-labs/turar-config/issues)
- [Changelog](https://github.com/yedoma-labs/turar-config/blob/main/CHANGELOG.md)

[0.3.0]: https://github.com/yedoma-labs/turar-config/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yedoma-labs/turar-config/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yedoma-labs/turar-config/releases/tag/v0.1.0
[Unreleased]: https://github.com/yedoma-labs/turar-config/compare/v0.3.0...HEAD
