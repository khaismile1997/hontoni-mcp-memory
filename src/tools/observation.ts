import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type Database from "better-sqlite3";
import {
	type CreateObservationInput,
	createObservation,
} from "../db/queries.js";
import type { Confidence, ObservationType } from "../db/schema.js";
import { parseFilePaths } from "../utils/paths.js";

export const observationTool: Tool = {
	name: "observation",
	description: `Create a structured observation for future reference.

Purpose:
- Capture decisions, bugs, features, patterns, discoveries, learnings, or warnings
- Auto-detects file references from content
- Stores in SQLite with FTS5 index for fast search

Type-specific examples:
- decision: "Use JWT for auth" - Chose JWT for stateless auth
- bugfix: "Fix null pointer on login" - Guarded optional user
- pattern: "Use zod for input validation" - All inputs validated with zod
- discovery: "Build copies .opencode/ to dist/" - Found rsync step
- warning: "Do not edit dist/ directly" - Built output overwritten`,
	inputSchema: {
		type: "object",
		properties: {
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
				description: "Type of observation",
			},
			title: {
				type: "string",
				description: "Brief description (required)",
			},
			narrative: {
				type: "string",
				description: "Context and reasoning",
			},
			facts: {
				type: "string",
				description: "Comma-separated key facts",
			},
			concepts: {
				type: "string",
				description: "Comma-separated searchable keywords",
			},
			files_read: {
				type: "string",
				description: "Comma-separated file paths that were read",
			},
			files_modified: {
				type: "string",
				description: "Comma-separated file paths that were modified",
			},
			confidence: {
				type: "string",
				enum: ["high", "medium", "low"],
				description: "Confidence level (default: high)",
			},
			supersedes: {
				type: "number",
				description: "ID of observation this replaces",
			},
			task_id: {
				type: "string",
				description: "Link to beads task ID",
			},
		},
		required: ["type", "title"],
	},
};

export function handleObservation(
	db: Database.Database,
	args: Record<string, unknown>,
): { id: number; message: string } {
	const input: CreateObservationInput = {
		type: args["type"] as ObservationType,
		title: args["title"] as string,
		narrative: args["narrative"] as string | undefined,
		facts: args["facts"] as string | undefined,
		concepts: args["concepts"] as string | undefined,
		files_read: args["files_read"]
			? parseFilePaths(args["files_read"] as string).join(",")
			: undefined,
		files_modified: args["files_modified"]
			? parseFilePaths(args["files_modified"] as string).join(",")
			: undefined,
		confidence: (args["confidence"] as Confidence) || "high",
		supersedes: args["supersedes"] as number | undefined,
		task_id: args["task_id"] as string | undefined,
	};

	const id = createObservation(db, input);

	return {
		id,
		message: `Created ${input.type} observation #${id}: "${input.title}"`,
	};
}
