import { homedir } from "node:os";
import { join } from "node:path";

export interface Config {
	dataDir: string;
	dbPath: string;
	sessionPath: string;
	backupDir: string;
	pluginsDir: string;
}

export function getConfig(): Config {
	const dataDir =
		process.env["HONTONI_DATA_DIR"]?.replace("~", homedir()) ||
		join(homedir(), ".hontoni-mcp");

	return {
		dataDir,
		dbPath: join(dataDir, "memory.db"),
		sessionPath: join(dataDir, "session.json"),
		backupDir: join(dataDir, "backup"),
		pluginsDir: join(dataDir, "plugins"),
	};
}

import { mkdirSync } from "node:fs";

export function ensureDataDir(config: Config): void {
	mkdirSync(config.dataDir, { recursive: true });
	mkdirSync(config.backupDir, { recursive: true });
	mkdirSync(config.pluginsDir, { recursive: true });
}
