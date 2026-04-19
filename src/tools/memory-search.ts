import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type Database from "better-sqlite3";
import { searchObservations } from "../db/queries.js";
import type { ObservationCompact } from "../db/schema.js";

export const memorySearchTool: Tool = {
	name: "memory_search",
	description: `Search memory across observations using full-text search.

PROACTIVE: Use this tool at the START of any task to check for relevant past context. Search before implementing to see if similar work was done before.

Purpose:
- Fast, ranked search across all observations (FTS5)
- Returns compact index for progressive disclosure
- Use memory_get for full details after identifying relevant observations

When to use (automatically):
- Starting work on a new task → search for related past work
- About to make a decision → search for prior decisions on same topic
- Debugging → search for similar bugs fixed before
- Implementing feature → search for patterns used elsewhere

Search modes:
- Default searches title, narrative, facts, and concepts
- Filter by type for more focused results`,
	inputSchema: {
		type: "object",
		properties: {
			query: {
				type: "string",
				description: "Search query (FTS5 syntax supported)",
			},
			type: {
				type: "string",
				enum: [
					"decision",
					"bugfix",
					"feature",
					"pattern",
					"discovery",
					"learning",
					"warning",
				],
				description: "Filter by observation type",
			},
			limit: {
				type: "number",
				description: "Max results (default: 10)",
			},
		},
		required: ["query"],
	},
};

export function handleMemorySearch(
	db: Database.Database,
	args: Record<string, unknown>,
): ObservationCompact[] {
	const query = args["query"] as string;
	const type = args["type"] as string | undefined;
	const limit = args["limit"] as number | undefined;

	return searchObservations(db, query, { type, limit });
}
