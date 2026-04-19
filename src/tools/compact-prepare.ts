import { existsSync, readFileSync } from "node:fs";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type Database from "better-sqlite3";
import type { Observation } from "../db/schema.js";
import type { Config } from "../utils/config.js";
import type { SessionContext } from "./session-save.js";

export const compactPrepareTool: Tool = {
	name: "compact_prepare",
	description: `Prepare context package for compaction recovery.

Purpose:
- Generate recovery prompt for new session
- Include current session state
- Include recent relevant observations
- Use before triggering /compact`,
	inputSchema: {
		type: "object",
		properties: {},
		required: [],
	},
};

interface CompactPrepareResult {
	session: SessionContext | null;
	recentObservations: Observation[];
	recoveryPrompt: string;
}

export function handleCompactPrepare(
	db: Database.Database,
	config: Config,
): CompactPrepareResult {
	// Load session
	let session: SessionContext | null = null;
	if (existsSync(config.sessionPath)) {
		try {
			const content = readFileSync(config.sessionPath, "utf-8");
			session = JSON.parse(content) as SessionContext;
		} catch {
			// Ignore parse errors
		}
	}

	// Get recent observations (last 24h, max 5)
	const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
	const recentObservations = db
		.prepare(
			`SELECT * FROM observations WHERE created_at_epoch > ? ORDER BY created_at_epoch DESC LIMIT 5`,
		)
		.all(cutoff) as Observation[];

	// Generate recovery prompt
	const recoveryPrompt = generateRecoveryPrompt(session, recentObservations);

	return {
		session,
		recentObservations,
		recoveryPrompt,
	};
}

function generateRecoveryPrompt(
	session: SessionContext | null,
	observations: Observation[],
): string {
	const lines: string[] = ["## Session Recovery", ""];

	if (session) {
		lines.push(`**Goal:** ${session.goal}`, "");
		lines.push(`**Current work:** ${session.currentWork}`, "");

		if (session.completed.length > 0) {
			lines.push("**Completed:**");
			for (const item of session.completed) {
				lines.push(`- ${item}`);
			}
			lines.push("");
		}

		if (session.next.length > 0) {
			lines.push("**Next:**");
			for (const item of session.next) {
				lines.push(`- ${item}`);
			}
			lines.push("");
		}

		if (session.workingFiles.length > 0) {
			lines.push("**Working files:**");
			for (const file of session.workingFiles) {
				lines.push(`- ${file}`);
			}
			lines.push("");
		}

		if (session.decisions.length > 0) {
			lines.push("**Decisions:**");
			for (const d of session.decisions) {
				lines.push(`- ${d.what}: ${d.why}`);
			}
			lines.push("");
		}

		if (session.taskId) {
			lines.push(`**Task:** ${session.taskId}`, "");
		}

		if (session.branch) {
			lines.push(`**Branch:** ${session.branch}`, "");
		}
	} else {
		lines.push("*No saved session found*", "");
	}

	if (observations.length > 0) {
		lines.push("**Recent observations:**");
		for (const obs of observations) {
			lines.push(`- [${obs.type}] ${obs.title}`);
		}
		lines.push("");
	}

	lines.push("---", "", "Continue where we left off.");

	return lines.join("\n");
}
