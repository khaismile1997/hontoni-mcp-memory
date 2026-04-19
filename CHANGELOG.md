# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.4] - 2026-04-19

### Added
- **`--append` / `-a` flag for init**: Add memory section to existing AGENTS.md without overwriting
- Compact memory section template for append mode (vs full template for new files)
- Detection of existing memory section to prevent duplicates

## [0.2.3] - 2026-04-19

### Added
- **CLI `init` command**: Run `npx hontoni-mcp-memory init` to create an AGENTS.md template
- Template includes memory ritual instructions for AI agents
- Supports `--force` / `-f` flag to overwrite existing file
- Added `help` command for CLI usage documentation

## [0.2.2] - 2026-04-19

### Changed
- **Enhanced `compact_prepare` with auto-detect hints**: Claude now knows to proactively detect when context is large and prepare for compaction
- Added detailed signs of large context (many tool calls, long outputs, deep debugging)
- Claude will auto-save, prepare recovery, then suggest user run `/compact`

## [0.2.1] - 2026-04-19

### Changed
- **Enhanced tool descriptions with PROACTIVE hints**: Claude now knows WHEN to use each tool automatically
- `observation`: Auto-create for decisions, bugfixes, patterns, discoveries, warnings
- `memory_search`: Auto-search at session start and before implementing
- `session_save`: Auto-save when ending work or before /compact
- `session_load`: Auto-load at session start to resume context

## [0.2.0] - 2026-04-19

### Added
- **MCP Prompts capability**: Server now exposes `memory_ritual` prompt
- Auto-inject instructions for Claude to use memory tools proactively
- Claude no longer needs manual AGENTS.md setup for memory usage

## [0.1.0] - 2026-04-19

### Added
- Initial release
- 8 MCP tools: `observation`, `memory_search`, `memory_get`, `memory_timeline`, `session_save`, `session_load`, `compact_prepare`, `memory_admin`
- SQLite database with FTS5 full-text search
- Session state persistence for `/compact` recovery
- Local-only data storage (privacy-first)
- Claude Code CLI integration support
