import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import type Database from "better-sqlite3";
import {
	archiveOldObservations,
	getStats,
	vacuumDatabase,
} from "../db/queries.js";

export const memoryAdminTool: Tool = {
	name: "memory_admin",
	description: `Memory system administration: maintenance and status.

Operations:
- "status": Storage stats and recommendations
- "archive": Archive old observations (>90 days by default)
- "vacuum": Vacuum database to reclaim space`,
	inputSchema: {
		type: "object",
		properties: {
			operation: {
				type: "string",
				enum: ["status", "archive", "vacuum"],
				description: "Admin operation to perform",
			},
			older_than_days: {
				type: "number",
				description: "Days threshold for archiving (default: 90)",
			},
		},
		required: ["operation"],
	},
};

type AdminResult =
	| ReturnType<typeof getStats>
	| { archived: number; message: string }
	| { success: boolean; message: string }
	| { error: string };

export function handleMemoryAdmin(
	db: Database.Database,
	args: Record<string, unknown>,
): AdminResult {
	const operation = args["operation"] as string;
	const olderThanDays = (args["older_than_days"] as number) ?? 90;

	switch (operation) {
		case "status":
			return getStats(db);

		case "archive": {
			const archived = archiveOldObservations(db, olderThanDays);
			return {
				archived,
				message: `Archived ${archived} observations older than ${olderThanDays} days`,
			};
		}

		case "vacuum":
			vacuumDatabase(db);
			return { success: true, message: "Database vacuumed" };

		default:
			return { error: `Unknown operation: ${operation}` };
	}
}
