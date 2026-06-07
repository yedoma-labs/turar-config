import express from "express";
import cors from "cors";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { createConfigSync } from "@yedoma-labs/turar-config";

// Load configuration with type-safe schema
const config = createConfigSync({
	schema: {
		server_port: eg.port().default(3000),
		server_host: eg.string().default("0.0.0.0"),
		cors_origins: eg.array().of("string"),
		database_host: eg.string().required(),
		database_port: eg.port().default(5432),
		database_name: eg.string().required(),
		database_pool_min: eg.integer().default(2),
		database_pool_max: eg.integer().default(10),
		redis_url: eg.url().required(),
		features_enableMetrics: eg.boolean().default(false),
		features_enableDebugMode: eg.boolean().default(false),
	},
	configDir: "./config",
	envFile: true,
	prefix: "APP_",
});

const app = express();

// Configure CORS from config
app.use(
	cors({
		origin: config.cors_origins,
		credentials: true,
	}),
);

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
	res.json({
		status: "healthy",
		timestamp: new Date().toISOString(),
		environment: process.env.NODE_ENV || "development",
		config: {
			database: `${config.database_host}:${config.database_port}/${config.database_name}`,
			redis: config.redis_url,
			metrics: config.features_enableMetrics,
			debug: config.features_enableDebugMode,
		},
	});
});

// Example API endpoint
app.get("/api/config", (req, res) => {
	res.json({
		server: {
			host: config.server_host,
			port: config.server_port,
		},
		database: {
			host: config.database_host,
			port: config.database_port,
			name: config.database_name,
			pool: {
				min: config.database_pool_min,
				max: config.database_pool_max,
			},
		},
		features: {
			metrics: config.features_enableMetrics,
			debug: config.features_enableDebugMode,
		},
	});
});

// Start server
const server = app.listen(config.server_port, config.server_host, () => {
	console.log(`🚀 Server running on http://${config.server_host}:${config.server_port}`);
	console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
	console.log(`🗄️  Database: ${config.database_host}:${config.database_port}/${config.database_name}`);
	console.log(`📦 Redis: ${config.redis_url}`);
	console.log(
		`📊 Metrics: ${config.features_enableMetrics ? "enabled" : "disabled"}`,
	);
	console.log(
		`🐛 Debug: ${config.features_enableDebugMode ? "enabled" : "disabled"}`,
	);
});

// Graceful shutdown
process.on("SIGTERM", () => {
	console.log("SIGTERM received, shutting down gracefully...");
	server.close(() => {
		console.log("Server closed");
		process.exit(0);
	});
});
