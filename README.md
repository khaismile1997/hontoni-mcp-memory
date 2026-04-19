# hontoni-mcp-memory

MCP (Model Context Protocol) server for memory and session management with Claude Code.

## Overview

This MCP server provides memory persistence and session recovery tools for AI coding assistants. All data is stored **locally** on your machine - nothing is sent to external servers.

## Features

- **Observation Storage**: Save decisions, patterns, discoveries, and learnings
- **Full-Text Search**: FTS5-powered search across all observations
- **Session Management**: Save and restore work context across /compact commands
- **Compaction Recovery**: Prepare recovery prompts before context reset

## Installation

### Via npx (recommended)

```bash
npx hontoni-mcp-memory
```

### Global install

```bash
npm install -g hontoni-mcp-memory
```

## Configuration

### Claude Code CLI (recommended)

```bash
claude mcp add --transport stdio hontoni-memory -- npx -y hontoni-mcp-memory
```

### Manual config

Add to your project's `.mcp.json` or `~/.claude.json`:

```json
{
  "mcpServers": {
    "hontoni-memory": {
      "command": "npx",
      "args": ["-y", "hontoni-mcp-memory"],
      "env": {
        "HONTONI_DATA_DIR": "~/.hontoni-mcp"
      }
    }
  }
}
```

## Available Tools

### observation

Create a structured observation for future reference.

```typescript
observation({
  type: "decision",  // decision | bugfix | feature | pattern | discovery | learning | warning
  title: "Use JWT for auth",
  narrative: "Chose JWT for stateless auth",
  concepts: "authentication, jwt",
  confidence: "high"
})
```

### memory_search

Search past observations using full-text search.

```typescript
memory_search({
  query: "authentication jwt",
  type: "decision",  // optional filter
  limit: 10
})
```

### memory_get

Get full observation details by ID.

```typescript
memory_get({ ids: "1,5,10" })
```

### memory_timeline

Get chronological context around an observation.

```typescript
memory_timeline({
  anchor_id: 42,
  depth_before: 5,
  depth_after: 5
})
```

### session_save

Save current work context.

```typescript
session_save({
  goal: "Implement user auth",
  current_work: "Adding JWT middleware",
  completed: "User model\nLogin endpoint",
  next: "Refresh tokens\nLogout",
  working_files: "src/auth.ts,src/middleware.ts"
})
```

### session_load

Load saved session context.

```typescript
session_load()
```

### compact_prepare

Prepare for /compact with recovery prompt.

```typescript
compact_prepare()
```

### memory_admin

Database administration.

```typescript
memory_admin({ operation: "status" })
memory_admin({ operation: "archive", older_than_days: 90 })
memory_admin({ operation: "vacuum" })
```

## Data Storage

All data is stored in `~/.hontoni-mcp/` (configurable via `HONTONI_DATA_DIR`):

```
~/.hontoni-mcp/
├── memory.db        # SQLite database with FTS5
├── session.json     # Current session context
└── backup/          # JSONL exports
```

## Privacy

- All data stored locally on your machine
- No network calls except to Claude Code (stdio)
- No telemetry or data collection

## Requirements

- Node.js 18+
- Claude Code with MCP support

## License

MIT
