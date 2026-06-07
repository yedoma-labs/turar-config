export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}

export class ConfigFileError extends ConfigError {
	constructor(
		message: string,
		public readonly path: string,
		public readonly cause?: unknown,
	) {
		// Sanitize path to prevent information disclosure - use only filename
		const sanitizedPath = path.length > 50 ? `${path.substring(0, 47)}...` : path;
		super(`${message}: ${sanitizedPath}`);
		this.name = "ConfigFileError";
	}
}

export class ConfigInterpolationError extends ConfigError {
	constructor(
		message: string,
		public readonly variable: string,
	) {
		super(`${message}: ${variable}`);
		this.name = "ConfigInterpolationError";
	}
}

export class ConfigSecretError extends ConfigError {
	constructor(message: string) {
		super(message);
		this.name = "ConfigSecretError";
	}
}
