import { readFileSync, writeFileSync } from "node:fs";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../utils/config.js";

export interface SessionContext {
	goal: string;
	currentWork: string;
	completed: string[];
	next: string[];
	workingFiles: string[];
	decisions: Array<{ what: string; why: string; when: string }>;
	taskId?: string;
	branch?: string;
	lastUpdated: string;
}

export const sessionSaveTool: Tool = {
	name: "session_save",
	description: `Save current work context for recovery.

Purpose:
- Checkpoint current work state
- Survives /compact commands
- Enables seamless session resume`,
	inputSchema: {
		type: "object",
		properties: {
			goal: {
				type: "string",
				description: "Current objective",
			},
			current_work: {
				type: "string",
				description: "What's being done now",
			},
			completed: {
				type: "string",
				description: "Newline-separated completed items",
			},
			next: {
				type: "string",
				description: "Newline-separated upcoming items",
			},
			working_files: {
				type: "string",
				description: "Comma-separated active file paths",
			},
			decisions: {
				type: "string",
				description: "JSON array of {what, why, when} objects",
			},
			task_id: {
				type: "string",
				description: "Current beads task ID",
			},
			branch: {
				type: "string",
				description: "Git branch name",
			},
		},
		required: ["goal", "current_work"],
	},
};

export function handleSessionSave(
	config: Config,
	args: Record<string, unknown>,
): { success: boolean; message: string } {
	const session: SessionContext = {
		goal: args["goal"] as string,
		currentWork: args["current_work"] as string,
		completed: parseLines(args["completed"] as string | undefined),
		next: parseLines(args["next"] as string | undefined),
		workingFiles: parseComma(args["working_files"] as string | undefined),
		decisions: parseDecisions(args["decisions"] as string | undefined),
		taskId: args["task_id"] as string | undefined,
		branch: args["branch"] as string | undefined,
		lastUpdated: new Date().toISOString(),
	};

	writeFileSync(config.sessionPath, JSON.stringify(session, null, 2));

	return {
		success: true,
		message: `Session saved: ${session.goal}`,
	};
}

function parseLines(input: string | undefined): string[] {
	if (!input) return [];
	return input
		.split("\n")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

function parseComma(input: string | undefined): string[] {
	if (!input) return [];
	return input
		.split(",")
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

function parseDecisions(
	input: string | undefined,
): Array<{ what: string; why: string; when: string }> {
	if (!input) return [];
	try {
		return JSON.parse(input);
	} catch {
		return [];
	}
}
