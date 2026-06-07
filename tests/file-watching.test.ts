import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eg } from "@yedoma-labs/bylyt-env-guard";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ConfigChange, type WatchHandle, watchConfig } from "../src/index.js";

describe("File Watching", () => {
	let testDir: string;
	let handle: WatchHandle | null = null;

	beforeEach(() => {
		testDir = join(tmpdir(), `turar-watch-test-${Date.now()}`);
		mkdirSync(testDir, { recursive: true });
	});

	afterEach(async () => {
		if (handle) {
			await handle.stop();
			handle = null;
		}
		rmSync(testDir, { recursive: true, force: true });
	});

	it("watches config directory for changes", async () => {
		// Create initial config
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ server: { port: 3000 } }));

		let changeDetected = false;
		let changeType: string | null = null;

		handle = await watchConfig({
			schema: {
				server_port: eg.integer(),
			},
			configDir: testDir,
			ignoreInitial: true,
			debounce: 100,
			onChange: (_newConfig, change) => {
				changeDetected = true;
				changeType = change.type;
			},
		});

		// Initial config should be loaded
		const initialConfig = handle.getConfig();
		expect(initialConfig.server_port).toBe(3000);

		// Modify config file
		await new Promise((resolve) => setTimeout(resolve, 200));
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ server: { port: 4000 } }));

		// Wait for change detection
		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(changeDetected).toBe(true);
		expect(changeType).toBe("changed");
	});

	it("provides updated config in onChange callback", async () => {
		writeFileSync(
			join(testDir, "default.json"),
			JSON.stringify({ database: { host: "localhost" } }),
		);

		let newConfigValue: string | null = null;

		handle = await watchConfig({
			schema: {
				database_host: eg.string(),
			},
			configDir: testDir,
			ignoreInitial: true,
			debounce: 100,
			onChange: (newConfig) => {
				newConfigValue = newConfig.database_host;
			},
		});

		// Modify config
		await new Promise((resolve) => setTimeout(resolve, 200));
		writeFileSync(
			join(testDir, "default.json"),
			JSON.stringify({ database: { host: "prod.example.com" } }),
		);

		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(newConfigValue).toBe("prod.example.com");
	});

	it("provides old and new config in onChange", async () => {
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ port: 3000 }));

		let oldValue: number | null = null;
		let newValue: number | null = null;
		let callbackCount = 0;

		handle = await watchConfig({
			schema: {
				port: eg.integer(),
			},
			configDir: testDir,
			ignoreInitial: true,
			debounce: 100,
			onChange: (newConfig, _change, oldConfig) => {
				if (callbackCount === 0) {
					oldValue = oldConfig.port;
					newValue = newConfig.port;
				}
				callbackCount++;
			},
		});

		await new Promise((resolve) => setTimeout(resolve, 300));
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ port: 8080 }));

		await new Promise((resolve) => setTimeout(resolve, 600));

		expect(oldValue).toBe(3000);
		expect(newValue).toBe(8080);
	});

	it("debounces rapid changes", async () => {
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ value: 1 }));

		let changeCount = 0;

		handle = await watchConfig({
			schema: {
				value: eg.integer(),
			},
			configDir: testDir,
			ignoreInitial: true,
			debounce: 500,
			onChange: () => {
				changeCount++;
			},
		});

		await new Promise((resolve) => setTimeout(resolve, 300));

		// Make rapid changes
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ value: 2 }));
		await new Promise((resolve) => setTimeout(resolve, 50));
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ value: 3 }));
		await new Promise((resolve) => setTimeout(resolve, 50));
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ value: 4 }));

		// Wait for debounce
		await new Promise((resolve) => setTimeout(resolve, 800));

		// Should only trigger once or twice due to debouncing (rapid writes might trigger 2)
		expect(changeCount).toBeLessThanOrEqual(2);
		expect(changeCount).toBeGreaterThanOrEqual(1);
	});

	it("watches YAML files", async () => {
		writeFileSync(join(testDir, "default.yaml"), "server:\n  port: 3000");

		let detected = false;

		handle = await watchConfig({
			schema: {
				server_port: eg.integer(),
			},
			configDir: testDir,
			ignoreInitial: true,
			debounce: 100,
			onChange: () => {
				detected = true;
			},
		});

		await new Promise((resolve) => setTimeout(resolve, 200));
		writeFileSync(join(testDir, "default.yaml"), "server:\n  port: 4000");

		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(detected).toBe(true);
	});

	it("watches TOML files", async () => {
		writeFileSync(join(testDir, "default.toml"), "[server]\nport = 3000");

		let detected = false;

		handle = await watchConfig({
			schema: {
				server_port: eg.integer(),
			},
			configDir: testDir,
			ignoreInitial: true,
			debounce: 100,
			onChange: () => {
				detected = true;
			},
		});

		await new Promise((resolve) => setTimeout(resolve, 200));
		writeFileSync(join(testDir, "default.toml"), "[server]\nport = 4000");

		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(detected).toBe(true);
	});

	it("provides change metadata", async () => {
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "value" }));

		let changeMetadata: ConfigChange | null = null;

		handle = await watchConfig({
			schema: {
				test: eg.string(),
			},
			configDir: testDir,
			ignoreInitial: true,
			debounce: 100,
			onChange: (_newConfig, change) => {
				changeMetadata = change;
			},
		});

		await new Promise((resolve) => setTimeout(resolve, 200));
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ test: "updated" }));

		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(changeMetadata).not.toBeNull();
		expect(changeMetadata?.type).toBe("changed");
		expect(changeMetadata?.path).toContain("default.json");
		expect(changeMetadata?.timestamp).toBeInstanceOf(Date);
	});

	it("stops watching when handle.stop() is called", async () => {
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ value: 1 }));

		let changeCount = 0;

		handle = await watchConfig({
			schema: {
				value: eg.integer(),
			},
			configDir: testDir,
			ignoreInitial: true,
			debounce: 200,
			onChange: () => {
				changeCount++;
			},
		});

		await new Promise((resolve) => setTimeout(resolve, 300));

		// Make a change
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ value: 2 }));
		await new Promise((resolve) => setTimeout(resolve, 600));
		const countBeforeStop = changeCount;
		expect(countBeforeStop).toBeGreaterThanOrEqual(1);

		// Stop watching
		await handle.stop();
		handle = null;

		// Make another change - should not be detected
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ value: 3 }));
		await new Promise((resolve) => setTimeout(resolve, 600));

		// Should not have incremented after stop
		expect(changeCount).toBe(countBeforeStop);
	});

	it("handles new file creation", async () => {
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ value: 1 }));

		let addDetected = false;

		handle = await watchConfig({
			schema: {
				value: eg.integer(),
			},
			configDir: testDir,
			ignoreInitial: true,
			debounce: 100,
			onChange: (_newConfig, change) => {
				if (change.type === "added") {
					addDetected = true;
				}
			},
		});

		await new Promise((resolve) => setTimeout(resolve, 200));

		// Create a new environment-specific config
		process.env.NODE_ENV = "production";
		writeFileSync(join(testDir, "production.json"), JSON.stringify({ value: 100 }));

		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(addDetected).toBe(true);

		delete process.env.NODE_ENV;
	});

	it("can access current config via getConfig()", async () => {
		writeFileSync(join(testDir, "default.json"), JSON.stringify({ value: 42 }));

		handle = await watchConfig({
			schema: {
				value: eg.integer(),
			},
			configDir: testDir,
			debounce: 100,
		});

		const currentConfig = handle.getConfig();
		expect(currentConfig.value).toBe(42);
	});
});
