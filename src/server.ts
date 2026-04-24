import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type Database from "better-sqlite3";
import {
	compactPrepareTool,
	handleCompactPrepare,
} from "./tools/compact-prepare.js";
import { handleMemoryAdmin, memoryAdminTool } from "./tools/memory-admin.js";
import { handleMemoryGet, memoryGetTool } from "./tools/memory-get.js";
import { handleMemorySearch, memorySearchTool } from "./tools/memory-search.js";
import {
	handleMemoryTimeline,
	memoryTimelineTool,
} from "./tools/memory-timeline.js";
// Tools
import { handleObservation, observationTool } from "./tools/observation.js";
import { handleSessionLoad, sessionLoadTool } from "./tools/session-load.js";
import { handleSessionSave, sessionSaveTool } from "./tools/session-save.js";
import type { Config } from "./utils/config.js";

export type ToolHandler = (args: Record<string, unknown>) => {
	content: Array<{ type: "text"; text: string }>;
};

export interface ToolRegistry {
	schema: Tool;
	handler: ToolHandler;
}

/**
 * Build the registry of built-in tools with their handlers bound to db/config.
 * Returns a map from tool name → { schema, handler }.
 */
export function buildToolRegistry(
	db: Database.Database,
	config: Config,
): Map<string, ToolRegistry> {
	const wrap = (
		result: unknown,
	): { content: Array<{ type: "text"; text: string }> } => ({
		content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
	});

	const registry = new Map<string, ToolRegistry>();

	const add = (
		schema: Tool,
		fn: (args: Record<string, unknown>) => unknown,
	) => {
		registry.set(schema.name, {
			schema,
			handler: (args) => {
				try {
					return wrap(fn(args));
				} catch (error) {
					return wrap({
						error: error instanceof Error ? error.message : String(error),
					});
				}
			},
		});
	};

	add(observationTool, (args) => handleObservation(db, args));
	add(memorySearchTool, (args) => handleMemorySearch(db, args));
	add(memoryGetTool, (args) => handleMemoryGet(db, args));
	add(memoryTimelineTool, (args) => handleMemoryTimeline(db, args));
	add(sessionSaveTool, (args) => handleSessionSave(config, args));
	add(sessionLoadTool, (_args) => handleSessionLoad(config));
	add(compactPrepareTool, (_args) => handleCompactPrepare(db, config));
	add(memoryAdminTool, (args) => handleMemoryAdmin(db, args));

	return registry;
}

/**
 * Extract tool schemas from registry for the tools/list response.
 */
export function getToolSchemas(registry: Map<string, ToolRegistry>): Tool[] {
	return Array.from(registry.values()).map((entry) => entry.schema);
}

/**
 * Dispatch a tool call through the registry.
 */
export function dispatchToolCall(
	registry: Map<string, ToolRegistry>,
	name: string,
	args: Record<string, unknown>,
): { content: Array<{ type: "text"; text: string }> } {
	const entry = registry.get(name);
	if (!entry) {
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({ error: `Unknown tool: ${name}` }),
				},
			],
		};
	}
	return entry.handler(args);
}

// ---------------------------------------------------------------------------
// Legacy API — kept for backward compatibility with existing tests
// ---------------------------------------------------------------------------

/**
 * @deprecated Use buildToolRegistry + getToolSchemas instead.
 */
export function registerTools(): Tool[] {
	return [
		observationTool,
		memorySearchTool,
		memoryGetTool,
		memoryTimelineTool,
		sessionSaveTool,
		sessionLoadTool,
		compactPrepareTool,
		memoryAdminTool,
	];
}

/**
 * @deprecated Use buildToolRegistry + dispatchToolCall instead.
 */
export function handleToolCall(
	db: Database.Database,
	config: Config,
	name: string,
	args: Record<string, unknown>,
): { content: Array<{ type: "text"; text: string }> } {
	const registry = buildToolRegistry(db, config);
	return dispatchToolCall(registry, name, args);
}
