import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { initDatabase } from "../src/db/schema";
import { loadPlugins } from "../src/plugins";

describe("Plugin Loader", () => {
	let db: Database.Database;
	let tempDir: string;
	let pluginsDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "plugin-test-"));
		pluginsDir = join(tempDir, "plugins");
		mkdirSync(pluginsDir, { recursive: true });
		db = initDatabase({
			dataDir: tempDir,
			dbPath: join(tempDir, "test.db"),
			sessionPath: join(tempDir, "session.json"),
			backupDir: join(tempDir, "backup"),
			pluginsDir,
		});
	});

	afterEach(() => {
		db.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	// -------------------------------------------------------------------------
	// Basic loading behavior
	// -------------------------------------------------------------------------

	test("returns empty array when plugins dir is empty", async () => {
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toEqual([]);
	});

	test("returns empty array when plugins dir does not exist", async () => {
		const plugins = await loadPlugins(join(tempDir, "nonexistent"), db);
		expect(plugins).toEqual([]);
	});

	test("skips non-.plugin.mjs files", async () => {
		writeFileSync(join(pluginsDir, "README.md"), "# readme");
		writeFileSync(join(pluginsDir, "config.json"), "{}");
		writeFileSync(join(pluginsDir, "helper.js"), "// helper");
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toEqual([]);
	});

	// -------------------------------------------------------------------------
	// Error handling — broken plugins must not crash the server
	// -------------------------------------------------------------------------

	test("skips plugin with invalid JS syntax", async () => {
		writeFileSync(
			join(pluginsDir, "broken.plugin.mjs"),
			"this is @#$ not valid js!!!!",
		);
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toEqual([]);
	});

	test("skips plugin missing name field", async () => {
		writeFileSync(
			join(pluginsDir, "noname.plugin.mjs"),
			`export default { tools: [] };`,
		);
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toEqual([]);
	});

	test("skips plugin missing tools array", async () => {
		writeFileSync(
			join(pluginsDir, "notools.plugin.mjs"),
			`export default { name: "test" };`,
		);
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toEqual([]);
	});

	test("skips plugin where tool is missing handler function", async () => {
		writeFileSync(
			join(pluginsDir, "nohandler.plugin.mjs"),
			`export default { name: "test", tools: [{ name: "tool1", description: "x", inputSchema: {type:"object"} }] };`,
		);
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toEqual([]);
	});

	// -------------------------------------------------------------------------
	// Successful loading
	// -------------------------------------------------------------------------

	test("loads a valid plugin with no migrations", async () => {
		writeFileSync(
			join(pluginsDir, "simple.plugin.mjs"),
			`export default {
  name: "simple",
  tools: [{
    name: "simple_ping",
    description: "Returns pong",
    inputSchema: { type: "object", properties: {} },
    handler: () => ({ pong: true })
  }]
};`,
		);
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toHaveLength(1);
		expect(plugins[0].name).toBe("simple");
		expect(plugins[0].tools).toHaveLength(1);
		expect(plugins[0].tools[0].name).toBe("simple_ping");
	});

	test("runs plugin migrations and creates table", async () => {
		writeFileSync(
			join(pluginsDir, "migrating.plugin.mjs"),
			`export default {
  name: "notes",
  migrations: [
    "CREATE TABLE IF NOT EXISTS plugin_notes_items (id INTEGER PRIMARY KEY, text TEXT)"
  ],
  tools: [{
    name: "notes_add",
    description: "Add note",
    inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
    handler: (args, db) => {
      db.prepare("INSERT INTO plugin_notes_items (text) VALUES (?)").run(args.text);
      return { added: true };
    }
  }]
};`,
		);
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toHaveLength(1);

		// Table must exist
		const row = db
			.prepare("SELECT COUNT(*) as c FROM plugin_notes_items")
			.get() as { c: number };
		expect(row.c).toBe(0);

		// Handler must work
		const result = plugins[0].tools[0].handler({ text: "hello" }, db);
		expect(result).toEqual({ added: true });

		const after = db
			.prepare("SELECT COUNT(*) as c FROM plugin_notes_items")
			.get() as { c: number };
		expect(after.c).toBe(1);
	});

	test("migration is idempotent — running twice does not fail", async () => {
		const sql =
			"CREATE TABLE IF NOT EXISTS plugin_idem_items (id INTEGER PRIMARY KEY)";
		writeFileSync(
			join(pluginsDir, "idem.plugin.mjs"),
			`export default { name: "idem", migrations: [${JSON.stringify(sql)}], tools: [{ name: "idem_noop", description: "x", inputSchema: {type:"object"}, handler: () => ({}) }] };`,
		);
		// Load twice — second run must not throw
		await loadPlugins(pluginsDir, db);
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toHaveLength(1);
	});

	test("logs warning and skips bad migration, but still loads the plugin", async () => {
		writeFileSync(
			join(pluginsDir, "badmig.plugin.mjs"),
			`export default {
  name: "badmig",
  migrations: ["NOT VALID SQL AT ALL"],
  tools: [{ name: "badmig_noop", description: "x", inputSchema: {type:"object"}, handler: () => ({}) }]
};`,
		);
		const plugins = await loadPlugins(pluginsDir, db);
		// Plugin loads despite bad migration
		expect(plugins).toHaveLength(1);
		expect(plugins[0].name).toBe("badmig");
	});

	test("loads multiple plugins", async () => {
		for (const name of ["alpha", "beta", "gamma"]) {
			writeFileSync(
				join(pluginsDir, `${name}.plugin.mjs`),
				`export default { name: "${name}", tools: [{ name: "${name}_noop", description: "x", inputSchema: {type:"object"}, handler: () => ({}) }] };`,
			);
		}
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toHaveLength(3);
		const names = plugins.map((p) => p.name).sort();
		expect(names).toEqual(["alpha", "beta", "gamma"]);
	});

	test("loads valid plugins even when one plugin file is broken", async () => {
		writeFileSync(
			join(pluginsDir, "good.plugin.mjs"),
			`export default { name: "good", tools: [{ name: "good_noop", description: "x", inputSchema: {type:"object"}, handler: () => ({}) }] };`,
		);
		writeFileSync(join(pluginsDir, "bad.plugin.mjs"), `SYNTAX ERROR @#$%`);
		const plugins = await loadPlugins(pluginsDir, db);
		expect(plugins).toHaveLength(1);
		expect(plugins[0].name).toBe("good");
	});
});
