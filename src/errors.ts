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
		// Better path sanitization: show basename + first 100 chars for context
		const basename = path.split(/[\\/]/).pop() || path;
		const sanitizedPath = path.length > 100 ? `${path.slice(0, 50)}...${basename}` : path;
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
	constructor(
		message: string,
		public readonly cause?: unknown,
	) {
		super(message);
		this.name = "ConfigSecretError";
	}
}
