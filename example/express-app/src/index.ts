import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { loadConfig } from "./config.js";

/**
 * Express.js application with turar-config integration
 */

// Load configuration
const config = loadConfig();

// Create Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration from config file
app.use(cors({
  origin: config.cors_origins,
  credentials: config.cors_credentials,
}));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging with configured format
app.use(morgan(config.logging_format));

// Trust proxy if configured
if (config.server_trustProxy) {
  app.set("trust proxy", 1);
}

// Routes
app.get("/", (req, res) => {
  res.json({
    message: "Express app with turar-config",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    redis: config.redis_enabled ? "enabled" : "disabled",
  });
});

app.get("/config-info", (req, res) => {
  // Return non-sensitive config info
  res.json({
    server: {
      port: config.server_port,
      host: config.server_host,
    },
    database: {
      host: config.database_host,
      port: config.database_port,
      name: config.database_name,
      pool: {
        min: config.database_pool_min,
        max: config.database_pool_max,
      },
      ssl: config.database_ssl,
    },
    redis: {
      enabled: config.redis_enabled,
      ttl: config.redis_ttl,
    },
    logging: {
      level: config.logging_level,
    },
    rateLimit: {
      windowMs: config.rateLimit_windowMs,
      max: config.rateLimit_max,
    },
  });
});

// Error handling
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: config.logging_level === "debug" ? err.message : undefined,
  });
});

// Start server
app.listen(config.server_port, config.server_host, () => {
  console.log("═══════════════════════════════════════════════");
  console.log("  EXPRESS APP - Server Started");
  console.log("═══════════════════════════════════════════════");
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`URL: http://${config.server_host}:${config.server_port}`);
  console.log("");
  console.log("Configuration:");
  console.log(`  CORS Origins: ${config.cors_origins.join(", ")}`);
  console.log(`  Database: ${config.database_host}:${config.database_port}/${config.database_name}`);
  console.log(`  Redis: ${config.redis_enabled ? "enabled" : "disabled"}`);
  console.log(`  Logging: ${config.logging_level} (${config.logging_format})`);
  console.log(`  Rate Limit: ${config.rateLimit_max} requests per ${config.rateLimit_windowMs}ms`);
  console.log("");
  console.log("Routes:");
  console.log("  GET /         - Welcome message");
  console.log("  GET /health   - Health check");
  console.log("  GET /config-info - Configuration info");
  console.log("═══════════════════════════════════════════════");
});

export { app, config };
