import type Database from "better-sqlite3";
import type {
	Confidence,
	Observation,
	ObservationCompact,
	ObservationType,
} from "./schema.js";

export interface CreateObservationInput {
	type: ObservationType;
	title: string;
	narrative?: string;
	subtitle?: string;
	facts?: string;
	concepts?: string;
	files_read?: string;
	files_modified?: string;
	supersedes?: number;
	task_id?: string;
	confidence?: Confidence;
}

/**
 * Insert a new observation
 */
export function createObservation(
	db: Database.Database,
	input: CreateObservationInput,
): number {
	const stmt = db.prepare(`
    INSERT INTO observations (type, title, narrative, subtitle, facts, concepts, files_read, files_modified, supersedes, task_id, confidence)
    VALUES (@type, @title, @narrative, @subtitle, @facts, @concepts, @files_read, @files_modified, @supersedes, @task_id, @confidence)
  `);

	const result = stmt.run({
		type: input.type,
		title: input.title,
		narrative: input.narrative ?? null,
		subtitle: input.subtitle ?? null,
		facts: input.facts ?? null,
		concepts: input.concepts ?? null,
		files_read: input.files_read ?? null,
		files_modified: input.files_modified ?? null,
		supersedes: input.supersedes ?? null,
		task_id: input.task_id ?? null,
		confidence: input.confidence ?? "high",
	});

	// If this supersedes another observation, update that one
	if (input.supersedes) {
		db.prepare("UPDATE observations SET superseded_by = ? WHERE id = ?").run(
			result.lastInsertRowid,
			input.supersedes,
		);
	}

	return Number(result.lastInsertRowid);
}

/**
 * Escape FTS5 special characters in query if needed
 * Preserves intentional FTS5 operators (AND, OR, NOT) for advanced searches
 */
function escapeFts5Query(query: string): string {
	// If query contains FTS5 operators, assume user knows what they're doing
	if (/\b(AND|OR|NOT)\b/.test(query)) {
		return query;
	}
	// Quote the query to treat it as a phrase/literal, escaping internal quotes
	// This prevents hyphens and other special chars from being interpreted
	return `"${query.replace(/"/g, '""')}"`;
}

/**
 * Search observations using FTS5
 */
export function searchObservations(
	db: Database.Database,
	query: string,
	options: { type?: string; limit?: number } = {},
): ObservationCompact[] {
	const limit = options.limit ?? 10;

	// Escape query for FTS5
	const escapedQuery = escapeFts5Query(query);

	// Build the query - use bm25() for ranking
	let sql = `
    SELECT o.id, o.type, o.title, 
           COALESCE(snippet(observations_fts, 1, '>>>', '<<<', '...', 30), o.narrative) as snippet,
           o.confidence, o.created_at
    FROM observations o
    JOIN observations_fts fts ON o.id = fts.rowid
    WHERE observations_fts MATCH @query
  `;

	if (options.type) {
		sql += " AND o.type = @type";
	}

	sql += " ORDER BY bm25(observations_fts) LIMIT @limit";

	const stmt = db.prepare(sql);

	return stmt.all({
		query: escapedQuery,
		type: options.type,
		limit,
	}) as ObservationCompact[];
}

/**
 * Get full observation by ID
 */
export function getObservation(
	db: Database.Database,
	id: number,
): Observation | null {
	const stmt = db.prepare("SELECT * FROM observations WHERE id = ?");
	return (stmt.get(id) as Observation) ?? null;
}

/**
 * Get multiple observations by IDs
 */
export function getObservations(
	db: Database.Database,
	ids: number[],
): Observation[] {
	if (ids.length === 0) return [];

	const placeholders = ids.map(() => "?").join(",");
	const stmt = db.prepare(
		`SELECT * FROM observations WHERE id IN (${placeholders})`,
	);
	return stmt.all(...ids) as Observation[];
}

/**
 * Get observations around an anchor point (for timeline)
 */
export function getTimeline(
	db: Database.Database,
	anchorId: number,
	depthBefore: number = 5,
	depthAfter: number = 5,
): { before: Observation[]; anchor: Observation | null; after: Observation[] } {
	const anchor = getObservation(db, anchorId);
	if (!anchor) {
		return { before: [], anchor: null, after: [] };
	}

	const before = db
		.prepare(
			`SELECT * FROM observations WHERE created_at_epoch < ? ORDER BY created_at_epoch DESC LIMIT ?`,
		)
		.all(anchor.created_at_epoch, depthBefore) as Observation[];

	const after = db
		.prepare(
			`SELECT * FROM observations WHERE created_at_epoch > ? ORDER BY created_at_epoch ASC LIMIT ?`,
		)
		.all(anchor.created_at_epoch, depthAfter) as Observation[];

	return { before: before.reverse(), anchor, after };
}

/**
 * Archive old observations
 */
export function archiveOldObservations(
	db: Database.Database,
	olderThanDays: number = 90,
): number {
	const cutoffEpoch =
		Math.floor(Date.now() / 1000) - olderThanDays * 24 * 60 * 60;

	const toArchive = db
		.prepare(
			`SELECT * FROM observations WHERE created_at_epoch < ? AND superseded_by IS NOT NULL`,
		)
		.all(cutoffEpoch) as Observation[];

	if (toArchive.length === 0) return 0;

	const insertArchive = db.prepare(`
    INSERT INTO observations_archive 
    (id, type, title, narrative, subtitle, facts, concepts, files_read, files_modified, 
     supersedes, superseded_by, task_id, confidence, created_at, created_at_epoch, updated_at)
    VALUES (@id, @type, @title, @narrative, @subtitle, @facts, @concepts, @files_read, @files_modified,
            @supersedes, @superseded_by, @task_id, @confidence, @created_at, @created_at_epoch, @updated_at)
  `);

	const deleteOriginal = db.prepare(`DELETE FROM observations WHERE id = ?`);

	const archiveMany = db.transaction((observations: Observation[]) => {
		for (const obs of observations) {
			insertArchive.run(obs);
			deleteOriginal.run(obs.id);
		}
		return observations.length;
	});

	return archiveMany(toArchive);
}

/**
 * Get database stats
 */
export function getStats(db: Database.Database): {
	totalObservations: number;
	byType: Record<string, number>;
	archivedCount: number;
	dbSizeBytes: number;
} {
	const total = db
		.prepare("SELECT COUNT(*) as count FROM observations")
		.get() as { count: number };

	const byTypeRows = db
		.prepare("SELECT type, COUNT(*) as count FROM observations GROUP BY type")
		.all() as { type: string; count: number }[];

	const archived = db
		.prepare("SELECT COUNT(*) as count FROM observations_archive")
		.get() as { count: number };

	const byType: Record<string, number> = {};
	for (const row of byTypeRows) {
		byType[row.type] = row.count;
	}

	// Get approximate DB size via page count
	const pageCount = db.pragma("page_count", { simple: true }) as number;
	const pageSize = db.pragma("page_size", { simple: true }) as number;

	return {
		totalObservations: total.count,
		byType,
		archivedCount: archived.count,
		dbSizeBytes: pageCount * pageSize,
	};
}

/**
 * Vacuum database
 */
export function vacuumDatabase(db: Database.Database): void {
	db.exec("VACUUM");
}
