# Agent Instructions

MCP server providing persistent memory and session management for Claude Code via SQLite + FTS5.

## Tech Stack

| Category | Technology |
|----------|------------|
| Runtime | Node.js >= 18 |
| Language | TypeScript (ES2022, NodeNext) |
| Database | better-sqlite3 ^11.0.0 with FTS5 |
| MCP SDK | @modelcontextprotocol/sdk ^1.0.0 |
| Validation | zod ^3.23.0 |
| Testing | Vitest ^4.1.4 |

## Structure

```
src/
├── index.ts          # Entry point
├── server.ts         # MCP tool registration + dispatch
├── cli/              # CLI commands (init.ts)
├── tools/            # 8 MCP tools (observation, memory_*, session_*, compact_*)
├── db/
│   ├── schema.ts     # SQLite schema + FTS5 triggers
│   └── queries.ts    # DB operations
├── prompts/          # MCP prompts (memory_ritual)
└── utils/            # Config, path helpers
tests/                # Vitest tests (42 passing)
```

## Commands

```bash
npm run build       # tsc → dist/
npm run test        # vitest run (42 tests)
npm run typecheck   # tsc --noEmit
npm run dev         # tsc --watch
```

## Code Example (Tool Registration)

```typescript
// src/server.ts:23-34
export function registerTools(): Tool[] {
  return [
    observationTool,      // Create structured observations
    memorySearchTool,     // FTS5 search
    memoryGetTool,        // Fetch by ID
    memoryTimelineTool,   // Chronological context
    sessionSaveTool,      // Persist session state
    sessionLoadTool,      // Load session state
    compactPrepareTool,   // Prepare for compaction
    memoryAdminTool,      // Archive, vacuum, migrate
  ];
}
```

## Conventions

- **MCP tools**: Each tool in `src/tools/{name}.ts` exports `{name}Tool` (schema) and `handle{Name}` (handler)
- **Schema**: SQLite triggers keep FTS5 in sync automatically — never modify schema without updating triggers
- **WAL mode**: Enabled for concurrent access
- **Storage**: `~/.hontoni-memory/memory.db` (configurable via `HONTONI_MEMORY_DIR`)

## Always / Ask / Never

- **Always**: Run `npm run typecheck` + `npm run test` before committing
- **Ask**: Before adding dependencies, changing `.opencode/` structure, or force-pushing
- **Never**: Edit `dist/` directly · Skip FTS5 sync triggers · Commit `.env` or credentials

## Shell Safety

Always use non-interactive flags — `cp`, `mv`, `rm` may be aliased to prompt on this system:

```bash
cp -f src dst    mv -f src dst    rm -f file    rm -rf dir
```

## Issue Tracking

Uses **bd** (beads). Run `bd onboard` to get started.

```bash
bd ready              # Find available work
bd update <id> --claim  # Claim atomically
bd close <id>         # Complete work
bd dolt push          # Sync to remote
```

<!-- BEGIN BEADS INTEGRATION profile:full hash:d4f96305 -->
## Issue Tracking with bd (beads)

**IMPORTANT**: This project uses **bd (beads)** for ALL issue tracking. Do NOT use markdown TODOs, task lists, or other tracking methods.

### Why bd?

- Dependency-aware: Track blockers and relationships between issues
- Git-friendly: Dolt-powered version control with native sync
- Agent-optimized: JSON output, ready work detection, discovered-from links
- Prevents duplicate tracking systems and confusion

### Quick Start

**Check for ready work:**

```bash
bd ready --json
```

**Create new issues:**

```bash
bd create "Issue title" --description="Detailed context" -t bug|feature|task -p 0-4 --json
bd create "Issue title" --description="What this issue is about" -p 1 --deps discovered-from:bd-123 --json
```

**Claim and update:**

```bash
bd update <id> --claim --json
bd update bd-42 --priority 1 --json
```

**Complete work:**

```bash
bd close bd-42 --reason "Completed" --json
```

### Issue Types

- `bug` - Something broken
- `feature` - New functionality
- `task` - Work item (tests, docs, refactoring)
- `epic` - Large feature with subtasks
- `chore` - Maintenance (dependencies, tooling)

### Priorities

- `0` - Critical (security, data loss, broken builds)
- `1` - High (major features, important bugs)
- `2` - Medium (default, nice-to-have)
- `3` - Low (polish, optimization)
- `4` - Backlog (future ideas)

### Workflow for AI Agents

1. **Check ready work**: `bd ready` shows unblocked issues
2. **Claim your task atomically**: `bd update <id> --claim`
3. **Work on it**: Implement, test, document
4. **Discover new work?** Create linked issue:
   - `bd create "Found bug" --description="Details about what was found" -p 1 --deps discovered-from:<parent-id>`
5. **Complete**: `bd close <id> --reason "Done"`

### Auto-Sync

bd automatically syncs via Dolt:

- Each write auto-commits to Dolt history
- Use `bd dolt push`/`bd dolt pull` for remote sync
- No manual export/import needed!

### Important Rules

- ✅ Use bd for ALL task tracking
- ✅ Always use `--json` flag for programmatic use
- ✅ Link discovered work with `discovered-from` dependencies
- ✅ Check `bd ready` before asking "what should I work on?"
- ❌ Do NOT create markdown TODO lists
- ❌ Do NOT use external issue trackers
- ❌ Do NOT duplicate tracking systems

For more details, see README.md and docs/QUICKSTART.md.

## Landing the Plane (Session Completion)

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds

<!-- END BEADS INTEGRATION -->
