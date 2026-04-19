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

/**
 * Register all available tools
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
 * Handle tool calls
 */
export function handleToolCall(
	db: Database.Database,
	config: Config,
	name: string,
	args: Record<string, unknown>,
): { content: Array<{ type: "text"; text: string }> } {
	try {
		let result: unknown;

		switch (name) {
			case "observation":
				result = handleObservation(db, args);
				break;
			case "memory_search":
				result = handleMemorySearch(db, args);
				break;
			case "memory_get":
				result = handleMemoryGet(db, args);
				break;
			case "memory_timeline":
				result = handleMemoryTimeline(db, args);
				break;
			case "session_save":
				result = handleSessionSave(config, args);
				break;
			case "session_load":
				result = handleSessionLoad(config);
				break;
			case "compact_prepare":
				result = handleCompactPrepare(db, config);
				break;
			case "memory_admin":
				result = handleMemoryAdmin(db, args);
				break;
			default:
				throw new Error(`Unknown tool: ${name}`);
		}

		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(result, null, 2),
				},
			],
		};
	} catch (error) {
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify({
						error: error instanceof Error ? error.message : String(error),
					}),
				},
			],
		};
	}
}
