import { existsSync, readFileSync } from "node:fs";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type { Config } from "../utils/config.js";
import type { SessionContext } from "./session-save.js";

export const sessionLoadTool: Tool = {
	name: "session_load",
	description: `Load saved context for recovery.

PROACTIVE: Use this tool at session START to check if there's saved context to resume from. Always check for previous session when beginning work.

Purpose:
- Retrieve saved session state
- Resume after /compact
- Get working context after restart

When to use:
- Starting a new conversation
- After /compact command
- User asks to "continue" or "resume"
- Returning to work after a break`,
	inputSchema: {
		type: "object",
		properties: {},
		required: [],
	},
};

export function handleSessionLoad(
	config: Config,
): SessionContext | { error: string } {
	if (!existsSync(config.sessionPath)) {
		return { error: "No saved session found" };
	}

	try {
		const content = readFileSync(config.sessionPath, "utf-8");
		return JSON.parse(content) as SessionContext;
	} catch (error) {
		return {
			error: `Failed to load session: ${error instanceof Error ? error.message : String(error)}`,
		};
	}
}
