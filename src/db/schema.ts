import Database from "better-sqlite3";
import type { Config } from "../utils/config.js";

/**
 * Initialize database with schema and FTS5 support
 */
export function initDatabase(config: Config): Database.Database {
	const db = new Database(config.dbPath);

	// Enable WAL mode for better concurrent access
	db.pragma("journal_mode = WAL");

	// Create schema
	db.exec(SCHEMA);

	return db;
}

const SCHEMA = `
-- Observations table
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('decision', 'bugfix', 'feature', 'pattern', 'discovery', 'learning', 'warning')),
  title TEXT NOT NULL,
  narrative TEXT,
  subtitle TEXT,
  
  -- Metadata (JSON arrays stored as text)
  facts TEXT,
  concepts TEXT,
  files_read TEXT,
  files_modified TEXT,
  
  -- Relationships
  supersedes INTEGER REFERENCES observations(id),
  superseded_by INTEGER,
  task_id TEXT,
  
  -- Confidence & timing
  confidence TEXT NOT NULL DEFAULT 'high' CHECK(confidence IN ('high', 'medium', 'low')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at_epoch INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at TEXT
);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS observations_fts USING fts5(
  title,
  narrative,
  facts,
  concepts,
  content='observations',
  content_rowid='id'
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER IF NOT EXISTS observations_ai AFTER INSERT ON observations BEGIN
  INSERT INTO observations_fts(rowid, title, narrative, facts, concepts)
  VALUES (new.id, new.title, new.narrative, new.facts, new.concepts);
END;

CREATE TRIGGER IF NOT EXISTS observations_ad AFTER DELETE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, title, narrative, facts, concepts)
  VALUES ('delete', old.id, old.title, old.narrative, old.facts, old.concepts);
END;

CREATE TRIGGER IF NOT EXISTS observations_au AFTER UPDATE ON observations BEGIN
  INSERT INTO observations_fts(observations_fts, rowid, title, narrative, facts, concepts)
  VALUES ('delete', old.id, old.title, old.narrative, old.facts, old.concepts);
  INSERT INTO observations_fts(rowid, title, narrative, facts, concepts)
  VALUES (new.id, new.title, new.narrative, new.facts, new.concepts);
END;

-- Archive table for old observations
CREATE TABLE IF NOT EXISTS observations_archive (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  narrative TEXT,
  subtitle TEXT,
  facts TEXT,
  concepts TEXT,
  files_read TEXT,
  files_modified TEXT,
  supersedes INTEGER,
  superseded_by INTEGER,
  task_id TEXT,
  confidence TEXT NOT NULL,
  created_at TEXT NOT NULL,
  created_at_epoch INTEGER NOT NULL,
  updated_at TEXT,
  archived_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(type);
CREATE INDEX IF NOT EXISTS idx_observations_created_at ON observations(created_at_epoch DESC);
CREATE INDEX IF NOT EXISTS idx_observations_task_id ON observations(task_id);
CREATE INDEX IF NOT EXISTS idx_observations_supersedes ON observations(supersedes);
`;

export type ObservationType =
	| "decision"
	| "bugfix"
	| "feature"
	| "pattern"
	| "discovery"
	| "learning"
	| "warning";

export type Confidence = "high" | "medium" | "low";

export interface Observation {
	id: number;
	type: ObservationType;
	title: string;
	narrative: string | null;
	subtitle: string | null;
	facts: string | null;
	concepts: string | null;
	files_read: string | null;
	files_modified: string | null;
	supersedes: number | null;
	superseded_by: number | null;
	task_id: string | null;
	confidence: Confidence;
	created_at: string;
	created_at_epoch: number;
	updated_at: string | null;
}

export interface ObservationCompact {
	id: number;
	type: ObservationType;
	title: string;
	snippet: string;
	confidence: Confidence;
	created_at: string;
}
