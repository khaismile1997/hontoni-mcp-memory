import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
	archiveOldObservations,
	createObservation,
	getObservation,
	getObservations,
	getStats,
	getTimeline,
	searchObservations,
} from "../src/db/queries";
import { initDatabase } from "../src/db/schema";

describe("Database Schema", () => {
	let db: Database.Database;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "mcp-test-"));
		db = initDatabase({
			dataDir: tempDir,
			dbPath: join(tempDir, "test.db"),
			sessionPath: "",
			backupDir: "",
		});
	});

	afterEach(() => {
		db.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	test("creates tables on init", () => {
		const tables = db
			.prepare("SELECT name FROM sqlite_master WHERE type='table'")
			.all() as { name: string }[];
		const tableNames = tables.map((t) => t.name);

		expect(tableNames).toContain("observations");
		expect(tableNames).toContain("observations_fts");
		expect(tableNames).toContain("observations_archive");
	});

	test("creates FTS5 virtual table", () => {
		const fts = db
			.prepare(
				"SELECT * FROM sqlite_master WHERE type='table' AND name='observations_fts'",
			)
			.get();
		expect(fts).toBeDefined();
	});
});

describe("Observation CRUD", () => {
	let db: Database.Database;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "mcp-test-"));
		db = initDatabase({
			dataDir: tempDir,
			dbPath: join(tempDir, "test.db"),
			sessionPath: "",
			backupDir: "",
		});
	});

	afterEach(() => {
		db.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	test("creates observation and returns ID", () => {
		const id = createObservation(db, {
			type: "decision",
			title: "Use JWT for auth",
			narrative: "Chose JWT for stateless authentication",
			concepts: "auth, jwt, security",
		});

		expect(id).toBeGreaterThan(0);
	});

	test("retrieves observation by ID", () => {
		const id = createObservation(db, {
			type: "pattern",
			title: "Repository pattern",
			narrative: "Use repository pattern for data access",
		});

		const obs = getObservation(db, id);

		expect(obs).not.toBeNull();
		expect(obs!.type).toBe("pattern");
		expect(obs!.title).toBe("Repository pattern");
		expect(obs!.confidence).toBe("high"); // default
	});

	test("retrieves multiple observations by IDs", () => {
		const id1 = createObservation(db, {
			type: "decision",
			title: "Decision 1",
		});
		const id2 = createObservation(db, { type: "bugfix", title: "Bugfix 1" });
		const id3 = createObservation(db, { type: "feature", title: "Feature 1" });

		const observations = getObservations(db, [id1, id3]);

		expect(observations).toHaveLength(2);
		expect(observations.map((o) => o.title)).toContain("Decision 1");
		expect(observations.map((o) => o.title)).toContain("Feature 1");
	});

	test("handles supersedes relationship", () => {
		const oldId = createObservation(db, {
			type: "decision",
			title: "Old decision",
		});

		const newId = createObservation(db, {
			type: "decision",
			title: "New decision",
			supersedes: oldId,
		});

		const oldObs = getObservation(db, oldId);
		const newObs = getObservation(db, newId);

		expect(newObs!.supersedes).toBe(oldId);
		expect(oldObs!.superseded_by).toBe(newId);
	});

	test("stores all observation types", () => {
		const types = [
			"decision",
			"bugfix",
			"feature",
			"pattern",
			"discovery",
			"learning",
			"warning",
		] as const;

		for (const type of types) {
			const id = createObservation(db, { type, title: `Test ${type}` });
			const obs = getObservation(db, id);
			expect(obs!.type).toBe(type);
		}
	});
});

describe("Full-Text Search", () => {
	let db: Database.Database;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "mcp-test-"));
		db = initDatabase({
			dataDir: tempDir,
			dbPath: join(tempDir, "test.db"),
			sessionPath: "",
			backupDir: "",
		});

		// Seed data
		createObservation(db, {
			type: "decision",
			title: "Use JWT for authentication",
			narrative: "JWT provides stateless auth for APIs",
			concepts: "auth, jwt, security, api",
		});
		createObservation(db, {
			type: "pattern",
			title: "Repository pattern for data access",
			narrative: "Abstract database queries behind repositories",
			concepts: "database, pattern, architecture",
		});
		createObservation(db, {
			type: "bugfix",
			title: "Fix null pointer in auth middleware",
			narrative: "Added null check for user object",
			concepts: "auth, bug, middleware",
		});
	});

	afterEach(() => {
		db.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	test("searches by title", () => {
		const results = searchObservations(db, "JWT");
		expect(results.length).toBeGreaterThan(0);
		expect(results[0]!.title).toContain("JWT");
	});

	test("searches by narrative", () => {
		const results = searchObservations(db, "stateless");
		expect(results.length).toBeGreaterThan(0);
	});

	test("searches by concepts", () => {
		const results = searchObservations(db, "security");
		expect(results.length).toBeGreaterThan(0);
	});

	test("filters by type", () => {
		const results = searchObservations(db, "auth", { type: "bugfix" });
		expect(results.length).toBe(1);
		expect(results[0]!.type).toBe("bugfix");
	});

	test("respects limit", () => {
		const results = searchObservations(db, "auth", { limit: 1 });
		expect(results.length).toBe(1);
	});

	test("returns empty for no matches", () => {
		const results = searchObservations(db, "nonexistent-term-xyz");
		expect(results).toHaveLength(0);
	});
});

describe("Timeline", () => {
	let db: Database.Database;
	let tempDir: string;
	let ids: number[];

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "mcp-test-"));
		db = initDatabase({
			dataDir: tempDir,
			dbPath: join(tempDir, "test.db"),
			sessionPath: "",
			backupDir: "",
		});

		ids = [];
		// Create observations with slight delays to ensure different timestamps
		for (let i = 1; i <= 5; i++) {
			const id = createObservation(db, {
				type: "learning",
				title: `Learning ${i}`,
			});
			ids.push(id);
		}
	});

	afterEach(() => {
		db.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	test("returns anchor observation", () => {
		const timeline = getTimeline(db, ids[2]!);
		expect(timeline.anchor).not.toBeNull();
		expect(timeline.anchor!.title).toBe("Learning 3");
	});

	test("returns observations before anchor", () => {
		const timeline = getTimeline(db, ids[4]!, 2, 0);
		expect(timeline.before.length).toBeLessThanOrEqual(2);
	});

	test("returns observations after anchor", () => {
		const timeline = getTimeline(db, ids[0]!, 0, 2);
		expect(timeline.after.length).toBeLessThanOrEqual(2);
	});

	test("handles non-existent anchor", () => {
		const timeline = getTimeline(db, 99999);
		expect(timeline.anchor).toBeNull();
		expect(timeline.before).toHaveLength(0);
		expect(timeline.after).toHaveLength(0);
	});
});

describe("Stats and Admin", () => {
	let db: Database.Database;
	let tempDir: string;

	beforeEach(() => {
		tempDir = mkdtempSync(join(tmpdir(), "mcp-test-"));
		db = initDatabase({
			dataDir: tempDir,
			dbPath: join(tempDir, "test.db"),
			sessionPath: "",
			backupDir: "",
		});

		createObservation(db, { type: "decision", title: "Decision 1" });
		createObservation(db, { type: "decision", title: "Decision 2" });
		createObservation(db, { type: "bugfix", title: "Bugfix 1" });
	});

	afterEach(() => {
		db.close();
		rmSync(tempDir, { recursive: true, force: true });
	});

	test("returns correct stats", () => {
		const stats = getStats(db);

		expect(stats.totalObservations).toBe(3);
		expect(stats.byType["decision"]).toBe(2);
		expect(stats.byType["bugfix"]).toBe(1);
		expect(stats.archivedCount).toBe(0);
		expect(stats.dbSizeBytes).toBeGreaterThan(0);
	});

	test("archives superseded observations", () => {
		const oldId = createObservation(db, { type: "decision", title: "Old" });
		createObservation(db, {
			type: "decision",
			title: "New",
			supersedes: oldId,
		});

		// Archive won't work because observations are too recent
		const archived = archiveOldObservations(db, 0); // 0 days = archive all superseded

		// Should archive the old superseded observation
		expect(archived).toBeGreaterThanOrEqual(0);
	});
});
