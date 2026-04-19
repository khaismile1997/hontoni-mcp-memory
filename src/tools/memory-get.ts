import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type Database from "better-sqlite3";
import { getObservations } from "../db/queries.js";
import type { Observation } from "../db/schema.js";

export const memoryGetTool: Tool = {
	name: "memory_get",
	description: `Get full observation details by ID.

Purpose:
- Progressive disclosure: fetch full details after identifying relevant observations via search
- Get complete narrative, facts, and metadata
- Supports multiple IDs for batch retrieval`,
	inputSchema: {
		type: "object",
		properties: {
			ids: {
				type: "string",
				description: 'Comma-separated observation IDs (e.g., "1,5,10")',
			},
		},
		required: ["ids"],
	},
};

export function handleMemoryGet(
	db: Database.Database,
	args: Record<string, unknown>,
): Observation[] {
	const idsStr = args["ids"] as string;
	const ids = idsStr
		.split(",")
		.map((s) => parseInt(s.trim(), 10))
		.filter((n) => !isNaN(n));

	return getObservations(db, ids);
}
