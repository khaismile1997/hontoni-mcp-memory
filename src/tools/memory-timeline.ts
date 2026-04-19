import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type Database from "better-sqlite3";
import { getTimeline } from "../db/queries.js";
import type { Observation } from "../db/schema.js";

export const memoryTimelineTool: Tool = {
	name: "memory_timeline",
	description: `Get chronological context around an observation.

Purpose:
- Progressive disclosure: see what was happening before/after a specific observation
- Understand decision context over time
- Navigate memory timeline`,
	inputSchema: {
		type: "object",
		properties: {
			anchor_id: {
				type: "number",
				description: "Observation ID to center the timeline on",
			},
			depth_before: {
				type: "number",
				description:
					"Number of observations to fetch before anchor (default: 5)",
			},
			depth_after: {
				type: "number",
				description:
					"Number of observations to fetch after anchor (default: 5)",
			},
		},
		required: ["anchor_id"],
	},
};

export function handleMemoryTimeline(
	db: Database.Database,
	args: Record<string, unknown>,
): { before: Observation[]; anchor: Observation | null; after: Observation[] } {
	const anchorId = args["anchor_id"] as number;
	const depthBefore = (args["depth_before"] as number) ?? 5;
	const depthAfter = (args["depth_after"] as number) ?? 5;

	return getTimeline(db, anchorId, depthBefore, depthAfter);
}
