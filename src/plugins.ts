import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type Database from "better-sqlite3";
import type { MemoryPlugin } from "./plugin.js";

/**
 * Allowlist of SQL statement prefixes permitted in plugin migrations.
 * Only additive DDL is allowed; destructive or data-modifying statements are rejected.
 */
const ALLOWED_MIGRATION_PREFIXES = [
	"create table",
	"create index",
	"create unique index",
	"create virtual table",
];

/**
 * Validate a single SQL statement from a plugin migration.
 * Returns an error string if the statement is not allowed, or null if it is safe.
 */
function validateMigrationStatement(statement: string): string | null {
	const normalized = statement.trim().toLowerCase();
	if (!normalized) return null; // empty/whitespace-only statements are fine to skip

	for (const prefix of ALLOWED_MIGRATION_PREFIXES) {
		if (normalized.startsWith(prefix)) return null;
	}

	return `Statement not permitted in migrations (only CREATE TABLE/INDEX IF NOT EXISTS allowed): "${statement.trim().slice(0, 80)}"`;
}

/**
 * Load all `.plugin.mjs` files from `pluginsDir`.
 *
 * Behavior:
 * - Non-existent or empty dir → returns `[]`
 * - Broken plugin (syntax error, missing required fields) → logs warning, skips, continues
 * - Migration SQL errors or forbidden statements → logs warning, skips that migration, continues loading the plugin
 *
 * SQLite convention: plugin tables must use the `plugin_<name>_<table>` prefix
 * and always use `CREATE TABLE IF NOT EXISTS` (migrations are idempotent).
 */
export async function loadPlugins(
	pluginsDir: string,
	db: Database.Database,
): Promise<MemoryPlugin[]> {
	if (!existsSync(pluginsDir)) {
		return [];
	}

	let entries: string[];
	try {
		entries = await readdir(pluginsDir);
	} catch {
		return [];
	}

	const pluginFiles = entries.filter((f) => f.endsWith(".plugin.mjs"));
	if (pluginFiles.length === 0) return [];

	const loaded: MemoryPlugin[] = [];

	for (const file of pluginFiles) {
		const fullPath = join(pluginsDir, file);
		const fileUrl = pathToFileURL(fullPath).href;

		let plugin: MemoryPlugin;
		try {
			const mod = await import(fileUrl);
			plugin = mod.default ?? mod;

			if (!plugin || typeof plugin !== "object") {
				throw new Error("Plugin export is not an object");
			}
			if (!plugin.name || typeof plugin.name !== "string") {
				throw new Error("Plugin missing required string field 'name'");
			}
			if (!Array.isArray(plugin.tools)) {
				throw new Error("Plugin missing required 'tools' array");
			}
			// Validate each tool has required fields
			for (const tool of plugin.tools) {
				if (!tool.name || typeof tool.name !== "string") {
					throw new Error(`Plugin tool missing 'name' field`);
				}
				if (typeof tool.handler !== "function") {
					throw new Error(`Tool '${tool.name}' missing 'handler' function`);
				}
			}
		} catch (err) {
			console.error(
				`[hontoni-memory] Warning: Failed to load plugin "${file}": ${
					err instanceof Error ? err.message : String(err)
				}`,
			);
			continue;
		}

		// Run migrations (idempotent — must use CREATE TABLE/INDEX IF NOT EXISTS)
		for (const sql of plugin.migrations ?? []) {
			// Validate each semicolon-separated statement before execution
			const statements = sql.split(";").filter((s) => s.trim().length > 0);
			let migrationValid = true;
			for (const stmt of statements) {
				const validationError = validateMigrationStatement(stmt);
				if (validationError) {
					console.error(
						`[hontoni-memory] Warning: Plugin "${plugin.name}" migration rejected — ${validationError}. Skipping this migration.`,
					);
					migrationValid = false;
					break;
				}
			}
			if (!migrationValid) continue;

			try {
				db.exec(sql);
			} catch (err) {
				console.error(
					`[hontoni-memory] Warning: Plugin "${plugin.name}" migration failed: ${
						err instanceof Error ? err.message : String(err)
					}. Skipping this migration.`,
				);
			}
		}

		loaded.push(plugin);
		console.error(
			`[hontoni-memory] Loaded plugin: ${plugin.name} (${plugin.tools.length} tool${plugin.tools.length === 1 ? "" : "s"})`,
		);
	}

	return loaded;
}
