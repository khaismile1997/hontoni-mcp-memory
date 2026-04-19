import * as fs from "node:fs";
import * as path from "node:path";

const AGENTS_MD_TEMPLATE = `# Memory System Integration

This project uses \`hontoni-mcp-memory\` for persistent AI memory across sessions.

## Memory Ritual

AI agents should follow this ritual every session:

### Session Start (Ground Phase)

\`\`\`
1. session_load() - Load previous session context
2. memory_search({ query: "<relevant keywords>" }) - Find related past work
3. Review findings before proceeding
\`\`\`

### During Work (Transform Phase)

\`\`\`
1. observation() - Record significant discoveries, decisions, patterns
   - Types: decision, bugfix, feature, pattern, discovery, learning, warning
   - Include: title, narrative, concepts, files_modified/files_read
   
2. memory_search() - Check for existing solutions before reinventing
\`\`\`

### Session End (Release Phase)

\`\`\`
1. session_save({ summary: "...", next_steps: [...] }) - Checkpoint progress
2. If context is large: compact_prepare() then suggest /compact to user
\`\`\`

## Observation Types

| Type | Use For |
|------|---------|
| \`decision\` | Architecture choices, tech selection |
| \`bugfix\` | Bug fixes with root cause |
| \`feature\` | New functionality added |
| \`pattern\` | Reusable patterns discovered |
| \`discovery\` | Non-obvious findings |
| \`learning\` | Lessons learned |
| \`warning\` | Pitfalls to avoid |

## Example Observations

\`\`\`typescript
// Decision
observation({
  type: "decision",
  title: "Use SQLite for local storage",
  narrative: "Chose SQLite over PostgreSQL for simplicity and zero-config local deployment.",
  concepts: "database, storage, architecture"
})

// Bugfix
observation({
  type: "bugfix", 
  title: "Fix race condition in auth",
  narrative: "Added mutex lock to prevent concurrent token refresh.",
  files_modified: "src/auth.ts",
  concepts: "auth, concurrency, bugfix"
})

// Pattern
observation({
  type: "pattern",
  title: "Error boundary pattern",
  narrative: "Wrap async handlers with try-catch and return structured errors.",
  concepts: "error-handling, patterns"
})
\`\`\`

## Key Principles

1. **Memory is cheap, re-discovery is expensive** - Record liberally
2. **Search before creating** - Check if solution exists
3. **Confidence scores matter** - Mark uncertain findings as \`medium\` or \`low\`
4. **Handoffs preserve momentum** - Always session_save before ending

## Storage Location

Memory is stored locally at \`~/.hontoni-memory/\`:
- \`memory.db\` - SQLite database with observations
- Privacy-first: no data leaves your machine
`;

// Shorter section for appending to existing AGENTS.md
const MEMORY_SECTION = `
<!-- BEGIN MEMORY INTEGRATION -->
## Memory System (hontoni-mcp-memory)

AI agents should use the memory tools proactively:

### Session Ritual

| Phase | Actions |
|-------|---------|
| **Start** | \`session_load()\` → \`memory_search({ query: "relevant keywords" })\` |
| **During** | \`observation({ type, title, narrative, concepts })\` for discoveries |
| **End** | \`session_save({ summary, next_steps })\` |

### Observation Types

\`decision\` · \`bugfix\` · \`feature\` · \`pattern\` · \`discovery\` · \`learning\` · \`warning\`

### Key Principles

- **Memory is cheap, re-discovery is expensive** — record liberally
- **Search before creating** — check if solution exists
- **Handoffs preserve momentum** — always session_save before ending

Storage: \`~/.hontoni-memory/memory.db\` (local, privacy-first)
<!-- END MEMORY INTEGRATION -->
`;

export function runInit(): void {
	const targetPath = path.join(process.cwd(), "AGENTS.md");
	const fileExists = fs.existsSync(targetPath);

	// Parse flags
	const forceFlag =
		process.argv.includes("--force") || process.argv.includes("-f");
	const appendFlag =
		process.argv.includes("--append") || process.argv.includes("-a");

	// Case 1: File exists + append flag → append memory section
	if (fileExists && appendFlag) {
		try {
			const existingContent = fs.readFileSync(targetPath, "utf-8");

			// Check if memory section already exists
			if (existingContent.includes("<!-- BEGIN MEMORY INTEGRATION -->")) {
				console.error(
					"❌ AGENTS.md already contains memory integration section.",
				);
				console.error(
					"   Remove the existing section first, or use --force to replace the entire file.",
				);
				process.exit(1);
			}

			// Append memory section
			const newContent = existingContent.trimEnd() + "\n" + MEMORY_SECTION;
			fs.writeFileSync(targetPath, newContent, "utf-8");

			console.log("✅ Appended memory ritual section to AGENTS.md");
			console.log(`   Location: ${targetPath}`);
			console.log("");
			console.log("Next steps:");
			console.log("1. Configure your MCP client to use hontoni-mcp-memory");
			console.log(
				"2. AI agents will now follow the memory ritual automatically",
			);
			return;
		} catch (error) {
			console.error("❌ Failed to append to AGENTS.md:", error);
			process.exit(1);
		}
	}

	// Case 2: File exists + no append + no force → error
	if (fileExists && !forceFlag) {
		console.error("❌ AGENTS.md already exists in current directory.");
		console.error("");
		console.error("Options:");
		console.error("   --append, -a    Add memory section to existing file");
		console.error("   --force, -f     Overwrite entire file");
		process.exit(1);
	}

	// Case 3: File exists + force → overwrite with full template
	if (fileExists && forceFlag) {
		console.log("⚠️  Overwriting existing AGENTS.md (--force flag used)");
	}

	// Case 4: File doesn't exist OR force flag → create full template
	try {
		const footer =
			"\n---\n\n_This file was generated by `npx hontoni-mcp-memory init`_\n";
		fs.writeFileSync(targetPath, AGENTS_MD_TEMPLATE + footer, "utf-8");
		console.log("✅ Created AGENTS.md with memory ritual template");
		console.log(`   Location: ${targetPath}`);
		console.log("");
		console.log("Next steps:");
		console.log("1. Configure your MCP client to use hontoni-mcp-memory");
		console.log("2. AI agents will now follow the memory ritual automatically");
	} catch (error) {
		console.error("❌ Failed to create AGENTS.md:", error);
		process.exit(1);
	}
}
