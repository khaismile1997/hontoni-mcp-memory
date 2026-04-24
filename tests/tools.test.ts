import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { initDatabase } from "../src/db/schema";
import { handleCompactPrepare } from "../src/tools/compact-prepare";
import { handleMemoryAdmin } from "../src/tools/memory-admin";
import { handleMemoryGet } from "../src/tools/memory-get";
import { handleMemorySearch } from "../src/tools/memory-search";
import { handleMemoryTimeline } from "../src/tools/memory-timeline";
import { handleObservation } from "../src/tools/observation";
import { handleSessionLoad } from "../src/tools/session-load";
import { handleSessionSave } from "../src/tools/session-save";
import type { Config } from "../src/utils/config";

describe("Tool Handlers", () => {
	let db: Database.Database;
	let config: Config;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "mcp-tool-test-"));
		config = {
			dataDir: tempDir,
			dbPath: join(tempDir, "test.db"),
			sessionPath: join(tempDir, "session.json"),
			backupDir: join(tempDir, "backup"),
			pluginsDir: join(tempDir, "plugins"),
		};
		db = initDatabase(config);
	});

	afterEach(() => {
		db.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	describe("observation tool", () => {
		test("creates observation and returns ID", () => {
			const result = handleObservation(db, {
				type: "decision",
				title: "Use TypeScript",
				narrative: "TypeScript provides better type safety",
				concepts: "typescript, types, safety",
			});

			expect(result.id).toBeGreaterThan(0);
			expect(result.message).toContain("decision");
			expect(result.message).toContain("Use TypeScript");
		});

		test("handles all observation types", () => {
			const types = [
				"decision",
				"bugfix",
				"feature",
				"pattern",
				"discovery",
				"learning",
				"warning",
			];

			for (const type of types) {
				const result = handleObservation(db, {
					type,
					title: `Test ${type}`,
				});
				expect(result.id).toBeGreaterThan(0);
			}
		});

		test("normalizes file paths", () => {
			const result = handleObservation(db, {
				type: "bugfix",
				title: "Fix bug",
				files_modified: "src/auth.ts, src/utils.ts",
			});

			expect(result.id).toBeGreaterThan(0);
		});
	});

	describe("memory_search tool", () => {
		beforeEach(() => {
			handleObservation(db, {
				type: "decision",
				title: "Use JWT for authentication",
				narrative: "JWT is stateless and scalable",
				concepts: "auth, jwt, security",
			});
			handleObservation(db, {
				type: "pattern",
				title: "Repository pattern",
				concepts: "database, pattern",
			});
		});

		test("searches observations", () => {
			const results = handleMemorySearch(db, { query: "JWT" });
			expect(results.length).toBeGreaterThan(0);
		});

		test("filters by type", () => {
			const results = handleMemorySearch(db, {
				query: "pattern",
				type: "pattern",
			});
			expect(results.length).toBe(1);
			expect(results[0]!.type).toBe("pattern");
		});

		test("respects limit", () => {
			const results = handleMemorySearch(db, {
				query: "auth OR pattern",
				limit: 1,
			});
			expect(results.length).toBe(1);
		});
	});

	describe("memory_get tool", () => {
		test("retrieves observations by IDs", () => {
			const { id: id1 } = handleObservation(db, {
				type: "decision",
				title: "Decision 1",
			});
			const { id: id2 } = handleObservation(db, {
				type: "bugfix",
				title: "Bugfix 1",
			});

			const results = handleMemoryGet(db, { ids: `${id1},${id2}` });

			expect(results).toHaveLength(2);
		});

		test("handles single ID", () => {
			const { id } = handleObservation(db, {
				type: "learning",
				title: "Learning 1",
			});
			const results = handleMemoryGet(db, { ids: String(id) });

			expect(results).toHaveLength(1);
			expect(results[0]!.title).toBe("Learning 1");
		});

		test("handles non-existent IDs", () => {
			const results = handleMemoryGet(db, { ids: "99999" });
			expect(results).toHaveLength(0);
		});
	});

	describe("memory_timeline tool", () => {
		test("returns timeline around anchor", () => {
			handleObservation(db, { type: "learning", title: "Learning 1" });
			const { id: anchorId } = handleObservation(db, {
				type: "learning",
				title: "Learning 2",
			});
			handleObservation(db, { type: "learning", title: "Learning 3" });

			const timeline = handleMemoryTimeline(db, { anchor_id: anchorId });

			expect(timeline.anchor).not.toBeNull();
			expect(timeline.anchor!.title).toBe("Learning 2");
		});

		test("handles non-existent anchor", () => {
			const timeline = handleMemoryTimeline(db, { anchor_id: 99999 });
			expect(timeline.anchor).toBeNull();
		});
	});

	describe("session_save tool", () => {
		test("saves session to file", () => {
			const result = handleSessionSave(config, {
				goal: "Implement authentication",
				current_work: "Adding JWT middleware",
				completed: "User model\nLogin endpoint",
				next: "Refresh tokens",
				working_files: "src/auth.ts,src/middleware.ts",
			});

			expect(result.success).toBe(true);
			expect(existsSync(config.sessionPath)).toBe(true);
		});

		test("parses completed items", () => {
			handleSessionSave(config, {
				goal: "Test",
				current_work: "Testing",
				completed: "Item 1\nItem 2\nItem 3",
			});

			const content = JSON.parse(readFileSync(config.sessionPath, "utf-8"));
			expect(content.completed).toHaveLength(3);
		});

		test("parses working files", () => {
			handleSessionSave(config, {
				goal: "Test",
				current_work: "Testing",
				working_files: "file1.ts, file2.ts, file3.ts",
			});

			const content = JSON.parse(readFileSync(config.sessionPath, "utf-8"));
			expect(content.workingFiles).toHaveLength(3);
		});
	});

	describe("session_load tool", () => {
		test("loads saved session", () => {
			handleSessionSave(config, {
				goal: "Test goal",
				current_work: "Test work",
			});

			const result = handleSessionLoad(config);

			expect("error" in result).toBe(false);
			if (!("error" in result)) {
				expect(result.goal).toBe("Test goal");
				expect(result.currentWork).toBe("Test work");
			}
		});

		test("returns error for missing session", () => {
			const result = handleSessionLoad(config);
			expect("error" in result).toBe(true);
		});
	});

	describe("compact_prepare tool", () => {
		test("returns recovery package", () => {
			handleSessionSave(config, {
				goal: "Test goal",
				current_work: "Test work",
			});

			handleObservation(db, {
				type: "decision",
				title: "Important decision",
			});

			const result = handleCompactPrepare(db, config);

			expect(result.session).not.toBeNull();
			expect(result.recoveryPrompt).toContain("Test goal");
			expect(result.recoveryPrompt).toContain("Session Recovery");
		});

		test("includes recent observations", () => {
			handleObservation(db, {
				type: "decision",
				title: "Recent decision",
			});

			const result = handleCompactPrepare(db, config);

			expect(result.recentObservations.length).toBeGreaterThan(0);
			expect(result.recoveryPrompt).toContain("Recent decision");
		});

		test("handles missing session", () => {
			const result = handleCompactPrepare(db, config);

			expect(result.session).toBeNull();
			expect(result.recoveryPrompt).toContain("No saved session found");
		});
	});

	describe("memory_admin tool", () => {
		test("returns status", () => {
			handleObservation(db, { type: "decision", title: "Test" });

			const result = handleMemoryAdmin(db, { operation: "status" });

			expect("totalObservations" in result).toBe(true);
			if ("totalObservations" in result) {
				expect(result.totalObservations).toBe(1);
			}
		});

		test("archives old observations", () => {
			const result = handleMemoryAdmin(db, {
				operation: "archive",
				older_than_days: 90,
			});

			expect("archived" in result).toBe(true);
		});

		test("vacuums database", () => {
			const result = handleMemoryAdmin(db, { operation: "vacuum" });

			expect("success" in result).toBe(true);
			if ("success" in result) {
				expect(result.success).toBe(true);
			}
		});

		test("handles unknown operation", () => {
			const result = handleMemoryAdmin(db, { operation: "unknown" });

			expect("error" in result).toBe(true);
		});
	});
});
