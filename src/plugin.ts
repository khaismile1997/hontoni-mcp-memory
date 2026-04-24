import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type Database from "better-sqlite3";

/**
 * A single tool provided by a plugin.
 */
export interface PluginTool {
	/** Tool name — must be unique across all plugins and built-in tools */
	name: string;
	/** Human-readable description shown in Claude Code's tool list */
	description: string;
	/**
	 * JSON Schema for the tool's input parameters.
	 * Must be a valid MCP tool inputSchema (type: "object" with properties).
	 */
	inputSchema: Tool["inputSchema"];
	/** Handler function — receives raw args and db handle, returns any serializable value */
	handler: (args: Record<string, unknown>, db: Database.Database) => unknown;
}

/**
 * A plugin definition — export this as default from your `.plugin.mjs` file.
 *
 * @example
 * ```javascript
 * // ~/.hontoni-memory/plugins/git-notes.plugin.mjs
 * export default {
 *   name: "git_notes",
 *   migrations: [
 *     `CREATE TABLE IF NOT EXISTS plugin_git_notes_commits (
 *        id INTEGER PRIMARY KEY AUTOINCREMENT,
 *        sha TEXT NOT NULL,
 *        note TEXT,
 *        created_at TEXT DEFAULT (datetime('now'))
 *      )`
 *   ],
 *   tools: [{
 *     name: "git_note_save",
 *     description: "Save a note for a git commit SHA",
 *     inputSchema: {
 *       type: "object",
 *       properties: { sha: { type: "string" }, note: { type: "string" } },
 *       required: ["sha", "note"]
 *     },
 *     handler: (args, db) => {
 *       db.prepare("INSERT INTO plugin_git_notes_commits (sha, note) VALUES (?, ?)")
 *         .run(args.sha, args.note);
 *       return { saved: true };
 *     }
 *   }]
 * };
 * ```
 *
 * **SQLite table naming convention:**
 * Plugin tables must use the prefix `plugin_<name>_<table>` and always include
 * `CREATE TABLE IF NOT EXISTS` to ensure idempotent startup behavior.
 * Never use ALTER TABLE or DROP TABLE in migrations.
 */
export interface MemoryPlugin {
	/** Plugin identifier — used as table prefix (e.g. "git_notes" → tables start with "plugin_git_notes_") */
	name: string;
	/**
	 * SQL strings to run at startup. Must use `CREATE TABLE IF NOT EXISTS`.
	 * Never ALTER or DROP — migrations are additive only.
	 */
	migrations?: string[];
	/** Tools to register with the MCP server */
	tools: PluginTool[];
}
